/**
 * search-sync.handler.ts
 *
 * Contract between the Kafka consumer and the OpenSearch product index.
 *
 * The concrete implementation is OpenSearchProductAdapter in
 * ../../opensearch/product-sync.ts. Keeping the contract here lets the
 * consumer be tested with a mock adapter and keeps OpenSearch details out of
 * the message-routing code.
 */

import {
  InventoryUpdatedPayload,
  ProductUpdatedPayload,
} from "../../types";

export interface SearchSyncAdapter {
  /** Re-index one product from PostgreSQL after a product.updated event. */
  applyProductUpdated(event: ProductUpdatedPayload): Promise<void>;

  /** Apply an inventory delta to the search document (PostgreSQL untouched). */
  applyInventoryUpdated(event: InventoryUpdatedPayload): Promise<void>;
}

/**
 * Backwards-compatible alias for older callers. The orders index is not part
 * of the product search scope, so the product adapter does not implement it.
 */
export interface OpenSearchAdapter {
  indexOrder(event: unknown): Promise<void>;
}
