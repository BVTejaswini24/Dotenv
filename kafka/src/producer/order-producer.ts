/**
 * order-producer.ts
 *
 * Publishes order_placed events to the Aiven Kafka topic.
 *
 * INTEGRATION CONTRACT WITH BACKEND TEAMMATE
 * ------------------------------------------
 * The Express backend calls publishOrderPlaced() ONLY after the PostgreSQL
 * transaction has successfully committed. This is non-negotiable for
 * correctness — publishing before a commit risks emitting an event for an
 * order that was never persisted.
 *
 * RECOMMENDED PATTERN (Transactional Outbox)
 * ------------------------------------------
 * Instead of calling publishOrderPlaced() directly from the request handler,
 * the backend teammate should write an outbox row inside the same transaction
 * as the order insert. A separate relay process then reads unprocessed outbox
 * rows and calls publishOrderPlaced(). This guarantees at-least-once delivery
 * without coupling Kafka to the HTTP request lifecycle.
 *
 * INTERFACE POINTS REQUIRING BACKEND TEAMMATE CONFIRMATION
 * ---------------------------------------------------------
 * 1. The exact shape of OrderPlacedPayload (see src/types.ts).
 * 2. The outbox table definition (if using the outbox pattern).
 * 3. How occurredAt is sourced — should be the DB-committed timestamp,
 *    not the time of publishing.
 */

import { Kafka, Producer, RecordMetadata } from "kafkajs";
import { v4 as uuidv4 } from "uuid";
import { createKafkaClient } from "../kafka-client";
import { OrderPlacedEvent, OrderPlacedPayload } from "../types";
import { loadConfig } from "../config";

// ---------------------------------------------------------------------------
// Producer singleton — one producer instance per process
// ---------------------------------------------------------------------------

let _kafka: Kafka | null = null;
let _producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
  if (_producer) return _producer;

  _kafka = createKafkaClient();
  _producer = _kafka.producer({
    // Wait for all in-sync replicas to acknowledge before confirming.
    // Prevents message loss if the leader broker fails immediately after write.
    allowAutoTopicCreation: false,
  });

  await _producer.connect();
  console.log("[ShopSphere Kafka] Producer connected to Aiven.");
  return _producer;
}

/**
 * Gracefully disconnects the producer.
 * Call this during process shutdown (SIGTERM/SIGINT).
 */
export async function disconnectProducer(): Promise<void> {
  if (_producer) {
    await _producer.disconnect();
    _producer = null;
    console.log("[ShopSphere Kafka] Producer disconnected.");
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Publishes a single order_placed event to Kafka.
 *
 * @param payload  The order payload.
 * @param occurredAt  ISO 8601 string of when the order was committed to the DB.
 *                    Must be supplied by the backend, not generated here.
 * @returns         Kafka RecordMetadata (partition, offset) for logging.
 */
export async function publishOrderPlaced(
  payload: OrderPlacedPayload,
  occurredAt: string
): Promise<RecordMetadata[]> {
  const producer = await getProducer();
  const config = loadConfig();

  const event: OrderPlacedEvent = {
    eventId: uuidv4(),          // unique envelope ID, used as idempotency key
    eventVersion: "1.0",
    eventName: "order_placed",
    occurredAt,                 // sourced from the backend commit timestamp
    payload,
  };

  const orderId = payload.order?.id ?? (payload as any).orderId ?? "order";

  const result = await producer.send({
    topic: config.topics.orders,
    messages: [
      {
        // Using orderId as the message key ensures all events for the same
        // order land on the same partition, preserving per-order ordering.
        key: orderId,
        value: JSON.stringify(event),
        headers: {
          eventVersion: event.eventVersion,
          eventName: event.eventName,
        },
      },
    ],
  });

  // KafkaJS returns offset as a string (Long). Convert explicitly for logging.
  // result[0] is always present when send() resolves without throwing.
  const partition = result[0]?.partition ?? -1;
  const offset = result[0]?.offset ?? "unknown";

  console.log(
    `[ShopSphere Kafka] Published order_placed | orderId=${orderId} | eventId=${event.eventId} | partition=${partition} | offset=${offset}`
  );

  return result;
}

// ---------------------------------------------------------------------------
// Dead-letter topic publisher
// ---------------------------------------------------------------------------

/**
 * Publishes a raw failed message to the dead-letter topic.
 *
 * The dead-letter topic name is derived by appending ".DLT" to the main topic.
 * Example: order_placed → order_placed.DLT
 *
 * This function reuses the same producer singleton — no second connection needed.
 *
 * PREREQUISITE: The DLT topic must be pre-created in the Aiven console before
 * this function is called. If the topic does not exist, this call will throw
 * (allowAutoTopicCreation is false).
 *
 * @param rawValue   The original raw message value (Buffer or string).
 * @param reason     A short description of why the message was dead-lettered.
 * @param originalTopic  The topic the message came from.
 */
export async function publishToDlt(
  rawValue: Buffer | string | null,
  reason: string,
  originalTopic: string
): Promise<void> {
  const producer = await getProducer();
  const config = loadConfig();
  const dltTopic = `${config.topics.orders}.DLT`;

  const dltMessage = JSON.stringify({
    originalTopic,
    reason,
    failedAt: new Date().toISOString(),
    rawValue: rawValue?.toString() ?? "EMPTY",
  });

  await producer.send({
    topic: dltTopic,
    messages: [{ value: dltMessage }],
  });

  console.log(
    `[ShopSphere Kafka] Dead-letter message published to ${dltTopic} | reason=${reason}`
  );
}
