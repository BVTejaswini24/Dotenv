/**
 * search-sync.handler.ts
 *
 * Handler stub: synchronises an order.placed event into the OpenSearch index.
 *
 * STATUS: STUB — awaiting Teammate 2 (OpenSearch) contract.
 *
 * Uses the confirmed snake_case backend event contract (EVENT_CONTRACT.md).
 * OrderPlacedPayload is the canonical type from types.ts.
 */

import { OrderPlacedPayload } from "../../types";

/**
 * Interface defining what this handler needs from an OpenSearch adapter.
 * Teammate 2 provides the concrete implementation.
 */
export interface OpenSearchAdapter {
  /**
   * Upserts an order document into the OpenSearch orders index.
   * Must be idempotent: calling with the same order.id must not create duplicates.
   * @param event  The full order.placed payload (snake_case).
   */
  indexOrder(event: OrderPlacedPayload): Promise<void>;
}

/**
 * Processes an order.placed event for OpenSearch indexing.
 *
 * @param event    The order.placed payload.
 * @param adapter  Injected OpenSearch adapter (provided by Teammate 2).
 */
export async function handleOrderPlacedForSearch(
  event: OrderPlacedPayload,
  adapter: OpenSearchAdapter
): Promise<void> {
  if (!adapter) {
    console.warn(
      `[ShopSphere Kafka] search-sync.handler: OpenSearchAdapter not yet provided. ` +
        `Skipping OpenSearch indexing for order.id=${event.order?.id}. ` +
        `Coordinate with the OpenSearch teammate to implement this handler.`
    );
    return;
  }

  console.log(
    `[ShopSphere Kafka] Indexing order in OpenSearch | order.id=${event.order?.id} | event_id=${event.event_id}`
  );

  await adapter.indexOrder(event);

  console.log(
    `[ShopSphere Kafka] OpenSearch indexing complete | order.id=${event.order?.id}`
  );
}
