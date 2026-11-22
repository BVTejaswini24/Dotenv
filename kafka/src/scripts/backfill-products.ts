/**
 * backfill-products.ts
 *
 * One-off, rerunnable backfill of the `shopsphere_products` OpenSearch index
 * from the ShopSphere PostgreSQL catalogue.
 *
 * SAFETY GUARANTEES
 * -----------------
 * - PostgreSQL is opened as a single READ ONLY session. Every statement this
 *   script issues is a SELECT (enforced by assertSelectOnly) and the session
 *   also sets default_transaction_read_only = on as defence in depth.
 * - No schema changes, no inserts, updates or deletes.
 * - The OpenSearch index is never created, deleted or recreated. If the index
 *   is missing the script aborts and asks you to run `npm run init:opensearch`.
 * - Documents use the product UUID as a deterministic _id, so reruns and
 *   retries overwrite the same documents instead of duplicating them.
 * - Bulk indexing is chunked; a failed chunk is retried and individual item
 *   failures are counted and reported without aborting the rest of the run.
 *
 * USAGE
 *   cd kafka
 *   npm run backfill:products                 # real backfill
 *   npm run backfill:products -- --dry-run    # read + transform only
 *   npm run backfill:products -- --page-size=100 --bulk-size=50
 *   npm run backfill:products -- --limit=25
 *
 * ENVIRONMENT
 *   DATABASE_URL   PostgreSQL connection string (read from kafka/.env,
 *                  backend/.env or the repository root .env, in that order)
 *   DATABASE_SSL   "true" to enable TLS, matching backend/src/db/pool.ts
 *   OPENSEARCH_*   consumed by ../opensearch/client.ts
 *
 * No credential is ever logged or printed.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { Client as PgClient } from "pg";

import { getOpenSearchClient } from "../opensearch/client";
import { PRODUCT_INDEX_NAME } from "../opensearch/index-setup";
import {
  buildProductDocument,
  productDocumentId,
  ProductSearchDocument,
  ProductSourceRow,
} from "../opensearch/product-document";

// ---------------------------------------------------------------------------
// Environment (.env files never override variables already in the process)
// ---------------------------------------------------------------------------

function loadEnv(): void {
  const candidates = [
    path.resolve(__dirname, "../../.env"), // kafka/.env
    path.resolve(__dirname, "../../../backend/.env"),
    path.resolve(__dirname, "../../../.env"),
  ];
  for (const candidate of candidates) {
    dotenv.config({ path: candidate });
  }
}

// ---------------------------------------------------------------------------
// CLI options
// ---------------------------------------------------------------------------

interface BackfillOptions {
  dryRun: boolean;
  pageSize: number;
  bulkSize: number;
  limit: number | null;
}

const DEFAULTS: BackfillOptions = {
  dryRun: false,
  pageSize: 200,
  bulkSize: 100,
  limit: null,
};

function parsePositiveInt(raw: string, flag: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

function parseArgs(argv: string[]): BackfillOptions {
  const options: BackfillOptions = { ...DEFAULTS };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--page-size=")) {
      options.pageSize = parsePositiveInt(arg.slice("--page-size=".length), "--page-size");
    } else if (arg.startsWith("--bulk-size=")) {
      options.bulkSize = parsePositiveInt(arg.slice("--bulk-size=".length), "--bulk-size");
    } else if (arg.startsWith("--limit=")) {
      options.limit = parsePositiveInt(arg.slice("--limit=".length), "--limit");
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: npm run backfill:products -- [options]",
          "",
          "  --dry-run           Read and transform only; no OpenSearch writes",
          "  --page-size=<n>     PostgreSQL keyset page size (default 200)",
          "  --bulk-size=<n>     Documents per bulk request (default 100)",
          "  --limit=<n>         Maximum source rows to process (default: all)",
          "  --help              Show this help",
        ].join("\n")
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg} (try --help)`);
    }
  }

  return options;
}

// ---------------------------------------------------------------------------
// Read-only PostgreSQL access
// ---------------------------------------------------------------------------

/**
 * Allowing only a single SELECT statement keeps this script from ever writing
 * to PostgreSQL, even if the SQL below is edited later.
 */
function assertSelectOnly(sql: string): void {
  const normalized = sql.trim();
  const isSingleSelect =
    /^select\b/i.test(normalized) && !normalized.replace(/;\s*$/, "").includes(";");
  if (!isSingleSelect) {
    throw new Error(
      "[ShopSphere Backfill] Refusing to run a non-SELECT statement against PostgreSQL."
    );
  }
}

const PRODUCTS_PAGE_SQL = `
  SELECT
    p.id,
    p.legacy_id,
    p.slug,
    p.title,
    p.description,
    p.brand,
    p.subcategory,
    p.gender,
    p.tags,
    p.image_url,
    p.price_paise,
    p.original_price_paise,
    p.discount_percentage,
    p.rating,
    p.review_count,
    p.is_new,
    p.is_featured,
    p.is_best_seller,
    p.is_on_sale,
    p.created_at,
    p.updated_at,
    p.product_sku,
    c.slug AS category_slug,
    c.name AS category_name,
    COALESCE(
      json_agg(
        json_build_object(
          'variant_id', v.id,
          'sku', v.sku,
          'size', v.size,
          'color', v.color,
          'price_paise', v.price_paise,
          'stock', COALESCE(i.quantity, 0)
        )
        ORDER BY v.size, v.color
      ) FILTER (WHERE v.id IS NOT NULL),
      '[]'::json
    ) AS variants
  FROM products p
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN product_variants v
    ON v.product_id = p.id AND v.is_active = true
  LEFT JOIN inventory i ON i.variant_id = v.id
  WHERE ($1::uuid IS NULL OR p.id > $1::uuid)
  GROUP BY p.id, c.id, c.slug, c.name
  ORDER BY p.id
  LIMIT $2
`;

const PRODUCT_COUNT_SQL = `
  SELECT COUNT(*)::text AS total
  FROM products p
  JOIN categories c ON c.id = p.category_id
`;

interface ReadOnlyDb {
  countProducts(): Promise<number>;
  page(afterId: string | null, limit: number): Promise<ProductSourceRow[]>;
  close(): Promise<void>;
}

async function openReadOnlyDb(): Promise<ReadOnlyDb> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "[ShopSphere Backfill] Missing DATABASE_URL. Set it in kafka/.env (or backend/.env). " +
        "No credentials are logged by this script."
    );
  }

  const useSsl = (process.env.DATABASE_SSL ?? "false").toLowerCase() === "true";
  const db = new PgClient({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    application_name: "shopsphere-products-backfill",
  });

  await db.connect();
  // Session-level guard: any accidental write would be rejected by PostgreSQL.
  await db.query("SET default_transaction_read_only = on");

  const query = async <T>(sql: string, values: unknown[] = []): Promise<T[]> => {
    assertSelectOnly(sql);
    const result = await db.query(sql, values);
    return result.rows as T[];
  };

  return {
    async countProducts(): Promise<number> {
      const rows = await query<{ total: string }>(PRODUCT_COUNT_SQL);
      return Number(rows[0]?.total ?? 0);
    },

    async page(afterId: string | null, limit: number): Promise<ProductSourceRow[]> {
      return query<ProductSourceRow>(PRODUCTS_PAGE_SQL, [afterId, limit]);
    },

    async close(): Promise<void> {
      await db.end();
    },
  };
}

// ---------------------------------------------------------------------------
// OpenSearch helpers
// ---------------------------------------------------------------------------

interface BulkFailure {
  id: string;
  reason: string;
}

interface BulkResult {
  indexed: number;
  failures: BulkFailure[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  label: string,
  attempts: number,
  fn: () => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        const delay = 500 * 2 ** (attempt - 1);
        console.warn(
          `[ShopSphere Backfill] ${label} failed (attempt ${attempt}/${attempts}); ` +
            `retrying in ${delay}ms.`
        );
        await sleep(delay);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function assertIndexExists(): Promise<void> {
  const client = getOpenSearchClient();
  const existsResponse = await client.indices.exists({ index: PRODUCT_INDEX_NAME });
  const exists = existsResponse.body === true || existsResponse.statusCode === 200;
  if (!exists) {
    throw new Error(
      `[ShopSphere Backfill] Index "${PRODUCT_INDEX_NAME}" does not exist. ` +
        `Run "npm run init:opensearch" first. This script never creates or deletes indices.`
    );
  }
}

async function bulkIndex(
  documents: ProductSearchDocument[]
): Promise<BulkResult> {
  if (documents.length === 0) return { indexed: 0, failures: [] };

  const client = getOpenSearchClient();
  const body: Array<Record<string, unknown>> = [];

  for (const document of documents) {
    body.push({ index: { _index: PRODUCT_INDEX_NAME, _id: document.uuid } });
    body.push(document as unknown as Record<string, unknown>);
  }

  const response = await withRetry("bulk request", 3, () =>
    client.bulk({ body })
  );

  const responseBody = response.body as {
    errors?: boolean;
    items?: Array<
      Record<
        string,
        {
          _id?: string;
          status?: number;
          error?: { type?: string; reason?: string };
        }
      >
    >;
  };

  const failures: BulkFailure[] = [];
  let indexed = 0;

  const items = responseBody.items;
  if (!Array.isArray(items)) {
    return {
      indexed: 0,
      failures: documents.map((document) => ({
        id: document.uuid,
        reason: "Bulk response did not contain per-item results",
      })),
    };
  }

  for (const item of items) {
    const result = item.index ?? item.create ?? item.update;
    if (!result) continue;

    const status = result.status ?? 0;
    if (status >= 200 && status < 300) {
      indexed++;
    } else {
      failures.push({
        id: result._id ?? "unknown",
        reason:
          `${status} ${result.error?.type ?? "unknown_error"}: ` +
          `${result.error?.reason ?? "no reason returned"}`,
      });
    }
  }

  return { indexed, failures };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  loadEnv();
  const options = parseArgs(process.argv.slice(2));

  console.log("------------------------------------------------------------");
  console.log("[ShopSphere Backfill] PostgreSQL → OpenSearch Product Backfill");
  console.log(`Target index: ${PRODUCT_INDEX_NAME}`);
  console.log(`Mode: ${options.dryRun ? "DRY RUN (no OpenSearch writes)" : "LIVE"}`);
  console.log(`Page size: ${options.pageSize} | Bulk size: ${options.bulkSize}`);
  console.log(`PostgreSQL access: READ ONLY (SELECT statements only)`);
  console.log("------------------------------------------------------------");

  // Fail fast if the index is missing — never create/delete it here.
  await assertIndexExists();

  const db = await openReadOnlyDb();
  const client = getOpenSearchClient();

  let fetched = 0;
  let prepared = 0;
  let indexed = 0;
  let skipped = 0;
  const failures: BulkFailure[] = [];
  let printedSample = false;

  try {
    const totalSourceRows = await db.countProducts();
    console.log(`[ShopSphere Backfill] Source product rows: ${totalSourceRows}`);

    let cursor: string | null = null;
    let done = false;

    while (!done) {
      const page = await db.page(cursor, options.pageSize);
      if (page.length === 0) break;

      const rows =
        options.limit === null
          ? page
          : page.slice(0, Math.max(0, options.limit - fetched));
      if (rows.length === 0) break;

      const documents: ProductSearchDocument[] = [];
      for (const row of rows) {
        if (!row.id || !row.slug || !row.title) {
          skipped++;
          console.warn(
            `[ShopSphere Backfill] Skipped invalid product row (id=${row.id ?? "null"}).`
          );
          continue;
        }
        documents.push(buildProductDocument(row));
      }
      prepared += documents.length;

      if (options.dryRun && !printedSample && documents.length > 0) {
        printedSample = true;
        console.log("[ShopSphere Backfill] Sample document:");
        console.log(JSON.stringify(documents[0], null, 2));
      }

      if (!options.dryRun) {
        for (let start = 0; start < documents.length; start += options.bulkSize) {
          const chunk = documents.slice(start, start + options.bulkSize);
          const result = await bulkIndex(chunk);
          indexed += result.indexed;
          for (const failure of result.failures) {
            failures.push(failure);
            if (failures.length <= 25) {
              console.warn(
                `[ShopSphere Backfill] Document failed | _id=${failure.id} | ${failure.reason}`
              );
            }
          }
        }
      }

      fetched += rows.length;
      cursor = rows[rows.length - 1].id;

      console.log(
        `[ShopSphere Backfill] Progress: fetched=${fetched} indexed=${indexed} ` +
          `failed=${failures.length} skipped=${skipped}`
      );

      if (options.limit !== null && fetched >= options.limit) done = true;
      if (page.length < options.pageSize) done = true;
    }

    if (options.dryRun) {
      console.log(
        "[ShopSphere Backfill] Dry run complete — no documents were indexed."
      );
    } else {
      await client.indices.refresh({ index: PRODUCT_INDEX_NAME });
    }

    const countResponse = await client.count({ index: PRODUCT_INDEX_NAME });
    const actualDocCount = Number(
      (countResponse.body as { count?: number }).count ?? 0
    );

    console.log("------------------------------------------------------------");
    console.log("[ShopSphere Backfill] Summary");
    console.log(`  Source rows fetched:   ${fetched}`);
    console.log(`  Documents prepared:    ${prepared}`);
    console.log(`  Indexed:               ${indexed}`);
    console.log(`  Failed:                ${failures.length}`);
    console.log(`  Skipped:               ${skipped}`);
    console.log(`  Documents in index:    ${actualDocCount}`);
    console.log(
      `  Renamed/recreated index: no (index "${PRODUCT_INDEX_NAME}" preserved)`
    );
    console.log("------------------------------------------------------------");

    if (failures.length > 0) {
      console.error(
        `[ShopSphere Backfill] Completed with ${failures.length} failed document(s). ` +
          "Re-run the script to retry them (writes are idempotent by product UUID)."
      );
      process.exitCode = 1;
    } else {
      console.log("[ShopSphere Backfill] Backfill complete ✓");
    }
  } finally {
    await db.close();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("------------------------------------------------------------");
  console.error("[ShopSphere Backfill] Backfill FAILED ✗");
  console.error(`Error: ${message}`);
  console.error("------------------------------------------------------------");
  process.exitCode = 1;
});
