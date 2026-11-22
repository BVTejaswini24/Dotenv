/**
 * test-live-sync.ts
 *
 * Controlled end-to-end verification of:
 *   PostgreSQL outbox → relay → Kafka → consumer → OpenSearch
 *
 * SAFETY
 * ------
 * - Refuses to run if any outbox event is already pending (so a real event is
 *   never published by this test).
 * - Writes ONLY three synthetic outbox rows: product.updated, then
 *   inventory.updated +1 and -1 for one variant. It never creates an order and
 *   never changes inventory, products, carts or orders.
 * - Uses a unique consumer group so production consumer offsets are untouched.
 * - PostgreSQL inventory stock is read before and after and must be identical.
 *
 * Uses the real Aiven PostgreSQL, Kafka and OpenSearch services.
 *
 * Usage: cd kafka && npm run test:live-sync
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path") as typeof import("path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require("dotenv") as typeof import("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../../backend/.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// The parent shell may export PORT=0; backend/src/config/env.ts rejects it and
// is loaded transitively by the outbox relay.
if (!process.env.PORT || !(Number(process.env.PORT) > 0)) {
  process.env.PORT = "4000";
}

// Unique group BEFORE any config module is evaluated at runtime.
const TEST_GROUP = `shopsphere-live-sync-${Date.now()}`;
process.env.KAFKA_GROUP_ID = TEST_GROUP;

import { randomUUID } from "node:crypto";
import { Client as PgClient, Pool } from "pg";
import { createKafkaClient } from "../kafka-client";
import { loadConfig } from "../config";
import { getOpenSearchClient } from "../opensearch/client";
import { PRODUCT_INDEX_NAME } from "../opensearch/index-setup";
import {
  createProductSyncStore,
  OpenSearchProductAdapter,
} from "../opensearch/product-sync";
import { startOrderConsumer, disconnectConsumer } from "../consumer/order-consumer";
import {
  CONSUMER_ID,
  createPgIdempotencyStore,
} from "../consumer/pg-idempotency-store";
import { runBatch } from "../relay/outbox-relay";
import { disconnectRelayProducer } from "../relay/publisher";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.error(`  FAIL  ${name}`, detail ?? "");
    failed++;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(
  label: string,
  predicate: () => Promise<boolean>,
  timeoutMs = 30_000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(250);
  }
  console.error(`  TIMEOUT waiting for ${label}`);
  return false;
}

function sslFor(envValue: string | undefined) {
  return (envValue ?? "false").toLowerCase() === "true"
    ? { rejectUnauthorized: false }
    : undefined;
}

async function main(): Promise<void> {
  console.log(`\nShopSphere live sync verification (group ${TEST_GROUP})\n`);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing DATABASE_URL");

  const readDb = new PgClient({
    connectionString,
    ssl: sslFor(process.env.DATABASE_SSL),
  });
  const writePool = new Pool({
    connectionString,
    ssl: sslFor(process.env.DATABASE_SSL),
    max: 3,
  });

  await readDb.connect();
  const pending = await readDb.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM outbox_events WHERE status = 'pending'"
  );
  if (Number(pending.rows[0].count) !== 0) {
    throw new Error(
      `Refusing to run: ${pending.rows[0].count} real outbox event(s) are pending.`
    );
  }
  console.log("  Pending outbox events before test: 0 (safe to proceed)\n");

  const product = await readDb.query<{
    id: string;
    legacy_id: number;
    slug: string;
    title: string;
    category: string;
    price_paise: string;
    variant_id: string;
    quantity: number;
  }>(
    `SELECT p.id, p.legacy_id, p.slug, p.title, c.slug AS category,
            p.price_paise, v.id AS variant_id, i.quantity
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
       JOIN inventory i ON i.variant_id = v.id
      ORDER BY p.legacy_id, v.sku
      LIMIT 1`
  );
  const source = product.rows[0];
  if (!source) throw new Error("No product with an active variant found");
  console.log(
    `  Test product: legacy_id=${source.legacy_id} uuid=${source.id} variant=${source.variant_id}\n`
  );

  const inventeryBefore = Number(source.quantity);
  const pgStock = async () =>
    (
      await readDb.query<{ quantity: number }>(
        "SELECT quantity FROM inventory WHERE variant_id = $1",
        [source.variant_id]
      )
    ).rows[0].quantity;

  const idempotencyPool = new Pool({
    connectionString,
    ssl: sslFor(process.env.DATABASE_SSL),
    max: 3,
  });
  const idempotencyStore = createPgIdempotencyStore(idempotencyPool);
  const productSyncStore = createProductSyncStore({ connectionString });
  const adapter = new OpenSearchProductAdapter(productSyncStore);
  const os = getOpenSearchClient();
  const config = loadConfig();
  const kafka = createKafkaClient();
  const duplicateProducer = kafka.producer({ allowAutoTopicCreation: false });

  async function insertOutbox(input: {
    eventType: "product.updated" | "inventory.updated";
    aggregateType: "product" | "product_variant";
    aggregateId: string;
    payload: Record<string, unknown>;
  }): Promise<{ id: string; eventId: string }> {
    const id = randomUUID();
    const eventId = randomUUID();
    const payload = {
      event_id: eventId,
      event_type: input.eventType,
      event_version: 1,
      occurred_at: new Date().toISOString(),
      ...input.payload,
    };
    await writePool.query(
      `INSERT INTO outbox_events
         (id, event_type, aggregate_type, aggregate_id, event_version, payload, status)
       VALUES ($1, $2, $3, $4, 1, $5, 'pending')`,
      [id, input.eventType, input.aggregateType, input.aggregateId, payload]
    );
    return { id, eventId };
  }

  async function isProcessed(eventId: string): Promise<boolean> {
    const result = await readDb.query(
      "SELECT 1 FROM processed_events WHERE consumer = $1 AND event_id = $2",
      [CONSUMER_ID, eventId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async function outboxStatus(id: string): Promise<string> {
    const result = await readDb.query<{ status: string }>(
      "SELECT status FROM outbox_events WHERE id = $1",
      [id]
    );
    return result.rows[0]?.status ?? "missing";
  }

  async function document(uuid: string) {
    const response = await os.get({ index: PRODUCT_INDEX_NAME, id: uuid });
    return response.body as {
      _version?: number;
      _source?: {
        title?: string;
        stock?: number;
        variants?: Array<{ variant_id: string; stock: number }>;
      };
    };
  }

  try {
    await startOrderConsumer(idempotencyStore, adapter);
    await sleep(3000); // allow partition assignment on the unique group

    // ---------------------------------------------------------------------
    // 1. product.updated: outbox → relay → Kafka → consumer → OpenSearch
    // ---------------------------------------------------------------------
    console.log("── product.updated pipeline ─────────────────────────────");
    const productEvent = await insertOutbox({
      eventType: "product.updated",
      aggregateType: "product",
      aggregateId: source.id,
      payload: {
        product: {
          id: source.legacy_id,
          uuid: source.id,
          slug: source.slug,
          title: source.title,
          category: source.category,
          price: Number(source.price_paise) / 100,
          stock: inventeryBefore,
          is_active: true,
        },
      },
    });

    const batch = await runBatch();
    check("relay published exactly one event", batch.published === 1 && batch.failed === 0, batch);
    check(
      "outbox row marked published",
      await waitFor("outbox published", async () => (await outboxStatus(productEvent.id)) === "published")
    );
    check(
      "consumer recorded the event in processed_events",
      await waitFor("processed event", () => isProcessed(productEvent.eventId))
    );

    const productDoc = await document(source.id);
    check("OpenSearch document exists", productDoc._source?.title === source.title, productDoc._source?.title);
    check(
      "OpenSearch document has variants",
      Array.isArray(productDoc._source?.variants) && productDoc._source!.variants!.length > 0
    );

    // ---------------------------------------------------------------------
    // 2. Duplicate delivery: same Kafka message, same event_id
    // ---------------------------------------------------------------------
    console.log("\n── duplicate delivery / idempotency ─────────────────────");
    const versionBefore = productDoc._version;
    await duplicateProducer.connect();
    await duplicateProducer.send({
      topic: config.topics.products,
      messages: [
        {
          key: source.id,
          value: JSON.stringify({
            event_id: productEvent.eventId,
            event_type: "product.updated",
            event_version: 1,
            occurred_at: new Date().toISOString(),
            product: { id: source.legacy_id, uuid: source.id },
          }),
          headers: {
            "event-id": productEvent.eventId,
            "event-type": "product.updated",
            "event-version": "1",
          },
        },
      ],
    });
    await sleep(4000);
    const duplicates = await readDb.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM processed_events WHERE consumer = $1 AND event_id = $2",
      [CONSUMER_ID, productEvent.eventId]
    );
    const versionAfter = (await document(source.id))._version;
    check("duplicate event processed exactly once", Number(duplicates.rows[0].count) === 1, duplicates.rows[0].count);
    check("duplicate did not rewrite the document", versionAfter === versionBefore, { versionBefore, versionAfter });

    // ---------------------------------------------------------------------
    // 3. inventory.updated +1 / -1: OpenSearch changes, PostgreSQL does not
    // ---------------------------------------------------------------------
    console.log("\n── inventory.updated pipeline ───────────────────────────");
    const beforeDoc = await document(source.id);
    const beforeVariantStock =
      beforeDoc._source?.variants?.find((v) => v.variant_id === source.variant_id)?.stock ?? 0;
    const pgBefore = await pgStock();

    const plus = await insertOutbox({
      eventType: "inventory.updated",
      aggregateType: "product_variant",
      aggregateId: source.variant_id,
      payload: {
        order_id: randomUUID(),
        variant_id: source.variant_id,
        product_id: source.legacy_id,
        sku: "TEST-LIVE-SYNC",
        quantity_change: 1,
      },
    });
    await runBatch();
    check(
      "inventory +1 event processed",
      await waitFor("inventory +1 processed", () => isProcessed(plus.eventId))
    );
    const afterPlus = await document(source.id);
    const plusStock =
      afterPlus._source?.variants?.find((v) => v.variant_id === source.variant_id)?.stock ?? -1;
    check(
      "OpenSearch variant stock increased by 1",
      plusStock === beforeVariantStock + 1,
      { beforeVariantStock, plusStock }
    );
    check("PostgreSQL inventory unchanged after +1", (await pgStock()) === pgBefore);

    const minus = await insertOutbox({
      eventType: "inventory.updated",
      aggregateType: "product_variant",
      aggregateId: source.variant_id,
      payload: {
        order_id: randomUUID(),
        variant_id: source.variant_id,
        product_id: source.legacy_id,
        sku: "TEST-LIVE-SYNC",
        quantity_change: -1,
      },
    });
    await runBatch();
    check(
      "inventory -1 event processed",
      await waitFor("inventory -1 processed", () => isProcessed(minus.eventId))
    );
    const afterMinus = await document(source.id);
    const minusStock =
      afterMinus._source?.variants?.find((v) => v.variant_id === source.variant_id)?.stock ?? -1;
    check("OpenSearch variant stock restored", minusStock === beforeVariantStock, {
      beforeVariantStock,
      minusStock,
    });
    check("PostgreSQL inventory unchanged after -1", (await pgStock()) === pgBefore);

    // Reconcile the document with PostgreSQL (source of truth) after the
    // deliberately artificial +1/-1 pair.
    await adapter.applyProductUpdated({
      event_id: "reconcile",
      event_type: "product.updated",
      event_version: 1,
      occurred_at: new Date().toISOString(),
      product: {
        id: source.legacy_id,
        uuid: source.id,
        slug: source.slug,
        title: source.title,
        category: source.category,
        price: Number(source.price_paise) / 100,
        stock: pgBefore,
        is_active: true,
      },
    });
    const reconciled = await document(source.id);
    const reconciledStock =
      reconciled._source?.variants?.find((v) => v.variant_id === source.variant_id)?.stock ?? -1;
    check("document reconciled to PostgreSQL stock", reconciledStock === pgBefore, {
      pgBefore,
      reconciledStock,
    });

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
  } finally {
    await duplicateProducer.disconnect().catch(() => undefined);
    await disconnectConsumer().catch(() => undefined);
    await disconnectRelayProducer().catch(() => undefined);
    await productSyncStore.close().catch(() => undefined);
    await idempotencyPool.end().catch(() => undefined);
    await writePool.end().catch(() => undefined);
    await readDb.end().catch(() => undefined);
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Live sync test crashed:", error);
  process.exit(1);
});
