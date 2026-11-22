/**
 * test-consumer.ts
 *
 * Standalone Aiven connectivity test for the ShopSphere Kafka consumer.
 *
 * PURPOSE
 * -------
 * Subscribes to the configured Aiven Kafka topic and logs every received
 * order_placed event to the console. Runs continuously until stopped with
 * SIGINT (Ctrl+C) or SIGTERM.
 *
 * Uses a no-op IdempotencyStore (in-memory, always returns false) and
 * null for the OpenSearch adapter. This is safe for testing only —
 * NOT acceptable for production use.
 *
 * This script has no dependency on PostgreSQL, OpenSearch, or any other
 * teammate's code. It only needs kafka/.env populated with real Aiven
 * credentials.
 *
 * USAGE
 *   cd kafka
 *   npm run test:consumer
 *
 *   Run the test producer in a separate terminal to send a message:
 *   npm run test:producer
 *
 * WHAT TO EXPECT ON SUCCESS
 *   [ShopSphere Kafka] Consumer connected | groupId=...
 *   [ShopSphere Kafka] Subscribed to topic: order_placed
 *   [ShopSphere Kafka] TEST CONSUMER: waiting for messages (Ctrl+C to stop)...
 *   [ShopSphere Kafka] TEST CONSUMER: received message — <full event JSON>
 *   [ShopSphere Kafka] Event processed | eventId=<uuid> | orderId=TEST-ORDER-001
 *
 * IDEMPOTENCY NOTE
 * ----------------
 * The NoopIdempotencyStore used here always reports events as unprocessed and
 * never records them. It exists only to satisfy the IdempotencyStore interface
 * during testing. Every message will be processed on every run.
 * The backend teammate must replace this with a PostgreSQL-backed implementation
 * before this consumer is used in production.
 *
 * OPENSEARCH NOTE
 * ---------------
 * null is passed as the OpenSearch adapter. The consumer logs a warning and
 * skips OpenSearch sync for each message. This is expected during testing.
 */

import { startOrderConsumer, disconnectConsumer, IdempotencyStore } from "../consumer/order-consumer";

// ---------------------------------------------------------------------------
// No-op IdempotencyStore — for testing only
// ---------------------------------------------------------------------------

/**
 * Testing-only implementation of IdempotencyStore.
 *
 * hasBeenProcessed always returns false  → every message is processed.
 * markAsProcessed does nothing           → no state is persisted.
 *
 * This is NOT safe for production. It allows duplicate processing on
 * consumer restart. Replace with the PostgreSQL-backed implementation
 * provided by the backend teammate.
 */
const noopIdempotencyStore: IdempotencyStore = {
  hasBeenProcessed: async (_eventId: string): Promise<boolean> => {
    return false;
  },
  markAsProcessed: async (_eventId: string): Promise<void> => {
    // No-op: intentionally does not persist anything.
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("------------------------------------------------------------");
  console.log("[ShopSphere Kafka] TEST CONSUMER — Aiven connectivity test");
  console.log(`[ShopSphere Kafka] Topic    : ${process.env.KAFKA_TOPIC_ORDER_PLACED ?? "order_placed (default)"}`);
  console.log("[ShopSphere Kafka] OpenSearch adapter : null (skipped)");
  console.log("[ShopSphere Kafka] IdempotencyStore   : no-op (testing only)");
  console.log("------------------------------------------------------------");

  // Graceful shutdown handler — called by SIGINT (Ctrl+C) and SIGTERM.
  // Declared before startOrderConsumer so it is registered even if startup fails.
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[ShopSphere Kafka] TEST CONSUMER: ${signal} received. Disconnecting...`);
    await disconnectConsumer();
    console.log("[ShopSphere Kafka] TEST CONSUMER: disconnected cleanly.");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  console.log("[ShopSphere Kafka] TEST CONSUMER: waiting for messages (Ctrl+C to stop)...");

  // startOrderConsumer connects, subscribes, and starts the run loop.
  // It does not return until the consumer crashes or is disconnected.
  await startOrderConsumer(
    noopIdempotencyStore,
    null // OpenSearch adapter not available yet
  );
}

main().catch((err) => {
  console.error("[ShopSphere Kafka] TEST CONSUMER: FAILED ✗", err);
  process.exit(1);
});
