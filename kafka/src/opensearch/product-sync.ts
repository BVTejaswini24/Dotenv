/**
 * product-sync.ts
 *
 * OpenSearch synchronisation for the Kafka consumer.
 *
 * - product.updated  → re-read the product from PostgreSQL (source of truth)
 *                      and upsert its full search document.
 * - inventory.updated → apply the quantity change to the nested variant in the
 *                      existing search document. PostgreSQL is NEVER modified
 *                      by this module; the backend already committed stock.
 *
 * PostgreSQL access is read-only. The only writes are idempotent OpenSearch
 * upserts/scripted updates keyed by the product UUID.
 */

import {
  InventoryUpdatedPayload,
  ProductUpdatedPayload,
} from "../types";
import { Pool } from "pg";
import { Client } from "@opensearch-project/opensearch";
import { getOpenSearchClient } from "./client";
import { PRODUCT_INDEX_NAME } from "./index-setup";
import {
  buildProductDocument,
  ProductSearchDocument,
  ProductSourceRow,
} from "./product-document";
import { PRODUCT_BY_UUID_SQL } from "./product-query";

export interface ProductSyncStore {
  /** Rebuilds and indexes one product document from PostgreSQL. */
  reindexProduct(productUuid: string): Promise<ProductSearchDocument>;
  /**
   * Applies an inventory delta to the nested variant and recomputes the
   * product-level stock. Returns the product UUID that was updated.
   */
  applyInventoryChange(
    variantId: string,
    quantityChange: number
  ): Promise<{ productUuid: string; document: ProductSearchDocument }>;
  close(): Promise<void>;
}

function databaseSsl() {
  return (process.env.DATABASE_SSL ?? "false").toLowerCase() === "true"
    ? { rejectUnauthorized: false }
    : undefined;
}

export function createProductSyncStore(options?: {
  connectionString?: string;
  client?: Client;
}): ProductSyncStore {
  const connectionString = options?.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString || connectionString.trim() === "") {
    throw new Error(
      "[ShopSphere Kafka] Missing DATABASE_URL for OpenSearch product sync."
    );
  }

  const pool = new Pool({
    connectionString,
    ssl: databaseSsl(),
    max: 5,
    application_name: "shopsphere-kafka-search-sync",
  });
  const openSearch = options?.client ?? getOpenSearchClient();

  async function loadDocument(productUuid: string): Promise<ProductSearchDocument> {
    const { rows } = await pool.query<ProductSourceRow>(PRODUCT_BY_UUID_SQL, [
      productUuid,
    ]);
    const row = rows[0];
    if (!row) {
      throw new Error(
        `[ShopSphere Kafka] Product ${productUuid} no longer exists in PostgreSQL.`
      );
    }
    return buildProductDocument(row);
  }

  async function reindexProduct(
    productUuid: string
  ): Promise<ProductSearchDocument> {
    const document = await loadDocument(productUuid);
    await openSearch.index({
      index: PRODUCT_INDEX_NAME,
      id: document.uuid,
      body: document,
      refresh: false,
    });
    return document;
  }

  return {
    reindexProduct,

    async applyInventoryChange(
      variantId: string,
      quantityChange: number
    ): Promise<{ productUuid: string; document: ProductSearchDocument }> {
      const { rows } = await pool.query<{ product_id: string }>(
        `SELECT product_id
           FROM product_variants
          WHERE id = $1::uuid AND is_active = true`,
        [variantId]
      );
      const productUuid = rows[0]?.product_id;
      if (!productUuid) {
        throw new Error(
          `[ShopSphere Kafka] Active variant ${variantId} not found in PostgreSQL.`
        );
      }

      const now = new Date().toISOString();
      const response = await openSearch.update({
        index: PRODUCT_INDEX_NAME,
        id: productUuid,
        retry_on_conflict: 3,
        body: {
          script: {
            lang: "painless",
            source: `
              if (ctx._source.variants != null) {
                for (def v : ctx._source.variants) {
                  if (v.variant_id == params.variantId) {
                    v.stock = Math.max(0, (v.stock == null ? 0 : v.stock) + params.delta);
                  }
                }
                def maxStock = 0;
                for (def v : ctx._source.variants) {
                  if (v.stock != null && v.stock > maxStock) {
                    maxStock = v.stock;
                  }
                }
                ctx._source.stock = maxStock;
                ctx._source.updated_at = params.now;
              }
            `,
            params: { variantId, delta: quantityChange, now },
          },
        },
      });

      const status = (response as { statusCode?: number }).statusCode;
      if (status === 404) {
        // Document missing (e.g. index restored from an older snapshot):
        // rebuild it from PostgreSQL instead of failing the event.
        const document = await reindexProduct(productUuid);
        return { productUuid, document };
      }

      const document = await loadDocument(productUuid);
      return { productUuid, document };
    },

    async close(): Promise<void> {
      await pool.end().catch(() => undefined);
    },
  };
}

/**
 * Implements the consumer-facing sync contract. Kept thin so the consumer's
 * retry/DLT/idempotency logic is independent of OpenSearch specifics.
 */
export class OpenSearchProductAdapter {
  constructor(private readonly store: ProductSyncStore) {}

  async applyProductUpdated(event: ProductUpdatedPayload): Promise<void> {
    const uuid = event.product?.uuid;
    if (!uuid) {
      throw new Error("product.updated payload is missing product.uuid");
    }
    await this.store.reindexProduct(uuid);
  }

  async applyInventoryUpdated(event: InventoryUpdatedPayload): Promise<void> {
    if (!event.variant_id || typeof event.quantity_change !== "number") {
      throw new Error(
        "inventory.updated payload is missing variant_id or quantity_change"
      );
    }
    await this.store.applyInventoryChange(
      event.variant_id,
      event.quantity_change
    );
  }
}
