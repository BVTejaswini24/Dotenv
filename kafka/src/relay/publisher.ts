/**
 * publisher.ts
 *
 * Generic Kafka publisher for the outbox relay.
 *
 * Publishes a backend outbox event exactly as received — payload is
 * JSON-serialised without any transformation. Field names remain snake_case.
 *
 * Message key  : aggregate_id  (per EVENT_CONTRACT.md)
 * Message value: JSON.stringify(event.payload)
 * Headers      : event-id, event-type, event-version (string)
 *
 * This module owns the KafkaJS Producer singleton for the relay process.
 * It does NOT publish order-placed specific logic — it handles all event types.
 */

import { Kafka, Producer } from "kafkajs";
import { createKafkaClient } from "../kafka-client";
import { OutboxEventRow } from "../types";
import { topicForEventType, dltTopicFor } from "./topic-map";

let _kafka: Kafka | null = null;
let _producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
  if (_producer) return _producer;

  _kafka = createKafkaClient();
  _producer = _kafka.producer({
    // Prevent accidental topic creation.
    allowAutoTopicCreation: false,
  });

  await _producer.connect();
  console.log("[ShopSphere Kafka] Relay producer connected to Aiven.");
  return _producer;
}

/**
 * Disconnects the relay producer.
 * Call during process shutdown.
 */
export async function disconnectRelayProducer(): Promise<void> {
  if (_producer) {
    await _producer.disconnect();
    _producer = null;
    console.log("[ShopSphere Kafka] Relay producer disconnected.");
  }
}

/**
 * Publishes one outbox event to its mapped Kafka topic.
 *
 * @param event  OutboxEventRow from runOutboxBatch().
 *               The payload is published as-is (snake_case, no transformation).
 */
export async function publishOutboxEvent(event: OutboxEventRow): Promise<void> {
  const producer = await getProducer();
  const topic = topicForEventType(event.event_type);

  const result = await producer.send({
    topic,
    messages: [
      {
        // aggregate_id ensures all events for one order/variant stay ordered
        // on the same partition.
        key: event.aggregate_id,
        value: JSON.stringify(event.payload),
        headers: {
          "event-id":      event.id,
          "event-type":    event.event_type,
          "event-version": String(event.event_version),
        },
      },
    ],
  });

  const partition = result[0]?.partition ?? -1;
  const offset    = result[0]?.offset    ?? "unknown";

  console.log(
    `[ShopSphere Kafka] Published | type=${event.event_type} | id=${event.id} | ` +
      `aggregate=${event.aggregate_id} | topic=${topic} | partition=${partition} | offset=${offset}`
  );
}

/**
 * Publishes a failed message to the dead-letter topic for manual inspection.
 *
 * The DLT topic must exist in Aiven before this is called.
 * Reuses the same producer singleton.
 *
 * @param event      Original outbox event (may be null if parsing failed).
 * @param rawValue   Original message value as a string.
 * @param reason     Human-readable error description.
 * @param sourceTopic  The topic the message came from.
 */
export async function publishToDlt(
  event: OutboxEventRow | null,
  rawValue: string | null,
  reason: string,
  sourceTopic: string
): Promise<void> {
  const producer = await getProducer();
  const dltTopic = dltTopicFor(sourceTopic);

  const dltMessage = JSON.stringify({
    source_topic:   sourceTopic,
    event_id:       event?.id ?? null,
    event_type:     event?.event_type ?? null,
    aggregate_id:   event?.aggregate_id ?? null,
    reason,
    failed_at:      new Date().toISOString(),
    original_value: rawValue ?? "EMPTY",
  });

  await producer.send({
    topic: dltTopic,
    messages: [{ value: dltMessage }],
  });

  console.log(
    `[ShopSphere Kafka] Dead-letter published | dlt=${dltTopic} | reason=${reason}`
  );
}
