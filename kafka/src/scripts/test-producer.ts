/**
 * test-producer.ts
 *
 * Standalone Aiven connectivity test for the ShopSphere Kafka producer.
 *
 * PURPOSE
 * -------
 * Publishes exactly one clearly labelled TEST order_placed event to the
 * configured Aiven Kafka topic, logs the confirmed partition and offset,
 * then disconnects cleanly.
 *
 * This script has no dependency on PostgreSQL, OpenSearch, or any other
 * teammate's code. It only needs kafka/.env populated with real Aiven
 * credentials.
 *
 * USAGE
 *   cd kafka
 *   npm run test:producer
 *
 * WHAT TO EXPECT ON SUCCESS
 *   [ShopSphere Kafka] Producer connected to Aiven.
 *   [ShopSphere Kafka] Published order_placed | orderId=TEST-ORDER-001 | eventId=<uuid> | partition=0 | offset=<n>
 *   [ShopSphere Kafka] TEST PRODUCER: message confirmed by broker. Partition=0 Offset=<n>
 *   [ShopSphere Kafka] Producer disconnected.
 *
 * WHAT TO EXPECT ON FAILURE
 *   A clear error message from KafkaJS (auth failure, TLS error, unknown topic, etc.)
 *   The process exits with code 1.
 *
 * DO NOT use this script with real customer or order data.
 * All payload fields are labelled TEST and use placeholder values only.
 */

import { publishOrderPlaced, disconnectProducer } from "../producer/order-producer";
import { OrderPlacedPayload } from "../types";

// ---------------------------------------------------------------------------
// Test payload — clearly labelled, no real data
// ---------------------------------------------------------------------------

/**
 * Synthetic test payload conforming to the backend OrderPlacedPayload contract.
 */
const TEST_PAYLOAD: OrderPlacedPayload = {
  event_id: "test-event-uuid-001",
  event_type: "order.placed",
  event_version: 1,
  occurred_at: new Date().toISOString(),
  order: {
    id: "TEST-ORDER-001",
    order_number: "SS-TEST-001",
    user_id: "TEST-CUSTOMER-001",
    status: "confirmed",
    currency: "USD",
    subtotal: 0,
    discount: 0,
    delivery_fee: 0,
    total: 0,
  },
  items: [
    {
      product_id: 1,
      product_uuid: "test-prod-uuid",
      variant_id: "test-var-uuid",
      sku: "TEST-PRODUCT-001",
      title: "Test Product",
      size: "M",
      color: "Black",
      quantity: 1,
      unit_price: 0,
      line_total: 0,
    },
  ],
  inventory: [
    {
      variant_id: "test-var-uuid",
      sku: "TEST-PRODUCT-001",
      quantity_change: -1,
    },
  ],
};

/**
 * occurredAt represents when the order occurred in the domain.
 * In production this comes from the backend's DB commit timestamp.
 * Here we use the current time since there is no real order.
 */
const TEST_OCCURRED_AT = new Date().toISOString();

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("------------------------------------------------------------");
  console.log("[ShopSphere Kafka] TEST PRODUCER — Aiven connectivity test");
  console.log(`[ShopSphere Kafka] Topic  : ${process.env.KAFKA_TOPIC_ORDERS ?? process.env.KAFKA_TOPIC_ORDER_PLACED ?? "shopsphere.orders (default)"}`);
  console.log(`[ShopSphere Kafka] Payload: orderId=${TEST_PAYLOAD.order.id}`);
  console.log("------------------------------------------------------------");

  try {
    const result = await publishOrderPlaced(TEST_PAYLOAD, TEST_OCCURRED_AT);

    const partition = result[0]?.partition ?? "unknown";
    const offset = result[0]?.offset ?? "unknown";

    console.log(
      `[ShopSphere Kafka] TEST PRODUCER: message confirmed by broker. Partition=${partition} Offset=${offset}`
    );
    console.log("[ShopSphere Kafka] TEST PRODUCER: PASSED ✓");
  } finally {
    // Always disconnect — even if publishOrderPlaced throws.
    await disconnectProducer();
  }
}

main().catch((err) => {
  console.error("[ShopSphere Kafka] TEST PRODUCER: FAILED ✗", err);
  process.exit(1);
});
