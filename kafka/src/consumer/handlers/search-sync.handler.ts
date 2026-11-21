/**
 * search-sync.handler.ts
 *
 * Handler stub: synchronises an order_placed event into the OpenSearch index.
 *
 * STATUS: STUB — awaiting Teammate 2 (OpenSearch) contract.
 *
 * INTERFACE POINTS REQUIRING OPENSEARCH TEAMMATE CONFIRMATION
 * ------------------------------------------------------------
 * Before this handler can be implemented, Teammate 2 must provide:
 *
 *   1. Aiven OpenSearch endpoint URL             → stored in env var OPENSEARCH_URL
 *   2. OpenSearch index name for orders          → e.g. "orders" or "shopsphere_orders"
 *   3. Authentication method                     → API key or basic auth?
 *   4. Document mapping / schema for an order    → which fields does the index expect?
 *   5. The OpenSearch client they are using      → @opensearch-project/opensearch?
 *   6. Desired upsert behaviour on duplicate     → index (overwrite) or update (merge)?
 *
 * IDEMPOTENCY NOTE
 * ----------------
 * An OpenSearch index-by-id (upsert) is naturally idempotent: indexing the same
 * orderId twice produces the same document. This handler therefore does NOT require
 * a database transaction for correctness — but the consumer still records the
 * eventId after success to avoid redundant processing work.
 *
 * HOW TO IMPLEMENT ONCE CONTRACT IS KNOWN
 * ----------------------------------------
 * 1. Add OPENSEARCH_URL and OPENSEARCH_INDEX_ORDERS to kafka/.env.example.
 * 2. Add them to src/config.ts.
 * 3. Install the OpenSearch client package inside kafka/ if Teammate 2 does not
 *    provide a shared client.
 * 4. Replace the TODO body below with the actual upsert call.
 */

import { OrderPlacedEvent } from "../../types";

/**
 * Interface defining what this handler needs from an OpenSearch adapter.
 * Teammate 2 provides the concrete implementation.
 */
export interface OpenSearchAdapter {
  /**
   * Upserts an order document into the OpenSearch orders index.
   * Must be idempotent: calling with the same orderId must not create duplicates.
   * @param event  The full order_placed event.
   */
  indexOrder(event: OrderPlacedEvent): Promise<void>;
}

/**
 * Processes an order_placed event for OpenSearch indexing.
 *
 * @param event    The order event to index.
 * @param adapter  Injected OpenSearch adapter (provided by Teammate 2).
 */
export async function handleOrderPlacedForSearch(
  event: OrderPlacedEvent,
  adapter: OpenSearchAdapter
): Promise<void> {
  // TODO: Remove this guard once Teammate 2 provides the adapter implementation.
  if (!adapter) {
    console.warn(
      `[ShopSphere Kafka] search-sync.handler: OpenSearchAdapter not yet provided. ` +
        `Skipping OpenSearch indexing for orderId=${event.payload.orderId}. ` +
        `Coordinate with the OpenSearch teammate to implement this handler.`
    );
    return;
  }

  console.log(
    `[ShopSphere Kafka] Indexing order in OpenSearch | orderId=${event.payload.orderId} | eventId=${event.eventId}`
  );

  await adapter.indexOrder(event);

  console.log(
    `[ShopSphere Kafka] OpenSearch indexing complete | orderId=${event.payload.orderId}`
  );
}
