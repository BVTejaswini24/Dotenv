/**
 * producer/outbox-relay.ts
 *
 * DEPRECATED — superseded by kafka/src/relay/outbox-relay.ts
 *
 * This file was the original provisional outbox-relay sketch, written before
 * the backend event contract was finalised. It referenced a provisional
 * camelCase payload shape (payload.orderId, config.topics.orderPlaced) that
 * does not match the actual backend contract.
 *
 * The active outbox relay is:
 *   kafka/src/relay/outbox-relay.ts        — polling loop
 *   kafka/src/relay/publisher.ts           — Kafka send with correct key/headers
 *   kafka/src/relay/topic-map.ts           — event_type → topic routing
 *   kafka/src/relay/worker.ts              — process entry point
 *
 * This file is kept for reference only. It MUST NOT be imported.
 * No code in this file runs in production.
 */

export {};
