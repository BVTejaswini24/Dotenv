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
 * Minimal provisional payload that satisfies the OrderPlacedPayload type.
 * All values are synthetic test data only.
 * Field names and types are PROVISIONAL — confirm with the backend teammate
 * before using this structure in production.
 */
const TEST_PAYLOAD: OrderPlacedPayload = {
  orderId: "TEST-ORDER-001",
  customerId: "TEST-CUSTOMER-001",
  totalAmount: 0,
  status: "test",
  items: [
    {
      productId: "TEST-PRODUCT-001",
      quantity: 1,
      unitPrice: 0,
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
  console.log(`[ShopSphere Kafka] Topic  : ${process.env.KAFKA_TOPIC_ORDER_PLACED ?? "order_placed (default)"}`);
  console.log(`[ShopSphere Kafka] Payload: orderId=${TEST_PAYLOAD.orderId}`);
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
