/**
 * consumer/order-consumer.ts
 *
 * Kafka consumer for ShopSphere.
 *
 * Subscribes to all three event topics:
 *   shopsphere.orders     — order.placed events
 *   shopsphere.inventory  — inventory.updated events
 *   shopsphere.products   — product.updated events
 *
 * Event envelope uses the backend's snake_case contract (EVENT_CONTRACT.md):
 *   event_id, event_type, event_version, occurred_at
 *
 * IDEMPOTENCY
 * -----------
 * Each event is deduplicated by (consumer_id, event_id) using the
 * processed_events PostgreSQL table (migration 002_extend_schema.sql).
 * Provide a createPgIdempotencyStore() instance from pg-idempotency-store.ts
 * for production. For testing, any object satisfying IdempotencyStore works.
 *
 * DEAD-LETTER
 * -----------
 * Failed messages after MAX_RETRIES are forwarded to <topic>.DLT via
 * relay/publisher.ts publishToDlt(). The DLT topics must be pre-created
 * in the Aiven console.
 *
 * OPENSEARCH
 * ----------
 * Pass null for openSearchAdapter to skip indexing until the OpenSearch
 * teammate provides a concrete adapter.
 */

import {
  Consumer,
  EachMessagePayload,
  Kafka,
  KafkaMessage,
} from "kafkajs";
import { createKafkaClient } from "../kafka-client";
import { loadConfig } from "../config";
import {
  validateOutboxPayload,
  OrderPlacedPayload,
  InventoryUpdatedPayload,
  ProductUpdatedPayload,
} from "../types";
import { publishToDlt } from "../relay/publisher";
import { SearchSyncAdapter } from "./handlers/search-sync.handler";

// ---------------------------------------------------------------------------
// Idempotency interface
// ---------------------------------------------------------------------------

/**
 * Durable store for recording processed event IDs.
 * Production implementation: createPgIdempotencyStore() from pg-idempotency-store.ts
 * Test implementation: any in-memory object satisfying this interface.
 */
export interface IdempotencyStore {
  /**
   * Returns true if this (eventId, eventType) pair has already been processed.
   */
  hasBeenProcessed(eventId: string, eventType: string): Promise<boolean>;

  /**
   * Records that this event was successfully processed.
   * For non-idempotent handlers this must be atomic with the side effect.
   */
  markAsProcessed(eventId: string, eventType: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Consumer configuration
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5;
const RETRY_INITIAL_MS = 300;

// ---------------------------------------------------------------------------
// Consumer singleton
// ---------------------------------------------------------------------------

let _kafka: Kafka | null = null;
let _consumer: Consumer | null = null;

async function getConsumer(): Promise<Consumer> {
  if (_consumer) return _consumer;

  const config = loadConfig();
  _kafka = createKafkaClient();

  _consumer = _kafka.consumer({ groupId: config.groupId });
  await _consumer.connect();
  console.log(
    `[ShopSphere Kafka] Consumer connected | groupId=${config.groupId}`
  );
  return _consumer;
}

/**
 * Gracefully disconnects the consumer.
 * Call during process shutdown (SIGTERM/SIGINT).
 */
export async function disconnectConsumer(): Promise<void> {
  if (_consumer) {
    await _consumer.disconnect();
    _consumer = null;
    console.log("[ShopSphere Kafka] Consumer disconnected.");
  }
}

// ---------------------------------------------------------------------------
// Message parsing
// ---------------------------------------------------------------------------

/**
 * Parsed result from a Kafka message.
 * event_type drives downstream dispatch.
 */
type ParsedEvent = {
  event_id: string;
  event_type: string;
  event_version: number;
  occurred_at: string;
  payload: Record<string, unknown>;
};

/**
 * Parses and validates an incoming Kafka message.
 * Returns a typed ParsedEvent on success, or null if the message is malformed.
 */
function parseMessage(message: KafkaMessage): ParsedEvent | null {
  if (!message.value) {
    console.error("[ShopSphere Kafka] Received message with null/empty value.");
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(message.value.toString());
  } catch (err) {
    console.error("[ShopSphere Kafka] Message value is not valid JSON.", {
      raw: message.value.toString(),
      err,
    });
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    console.error("[ShopSphere Kafka] Parsed message is not an object.");
    return null;
  }

  const p = parsed as Record<string, unknown>;

  // Read event_type from the payload (the backend embeds it in the payload).
  const eventType =
    typeof p.event_type === "string" ? p.event_type : "";

  // Use the generic validateOutboxPayload which checks all envelope fields.
  const validationError = validateOutboxPayload(eventType, parsed);
  if (validationError) {
    console.error(
      `[ShopSphere Kafka] Message failed validation: ${validationError}`,
      { raw: message.value.toString() }
    );
    return null;
  }

  return {
    event_id:      p.event_id as string,
    event_type:    p.event_type as string,
    event_version: p.event_version as number,
    occurred_at:   p.occurred_at as string,
    payload:       p,
  };
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

async function withRetry(
  label: string,
  fn: () => Promise<void>
): Promise<void> {
  let attempt = 0;
  let delayMs = RETRY_INITIAL_MS;

  while (attempt < MAX_RETRIES) {
    try {
      await fn();
      return;
    } catch (err) {
      attempt++;
      if (attempt >= MAX_RETRIES) {
        throw err;
      }
      console.warn(
        `[ShopSphere Kafka] ${label} failed (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delayMs}ms.`,
        { err }
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
}

// ---------------------------------------------------------------------------
// Per-event processing — dispatches by event_type
// ---------------------------------------------------------------------------

async function processEvent(
  event: ParsedEvent,
  idempotencyStore: IdempotencyStore,
  openSearchAdapter: SearchSyncAdapter | null
): Promise<void> {
  // Idempotency check using the actual backend schema: PRIMARY KEY (consumer, event_id)
  const alreadyProcessed = await idempotencyStore.hasBeenProcessed(
    event.event_id,
    event.event_type
  );
  if (alreadyProcessed) {
    console.log(
      `[ShopSphere Kafka] Duplicate event skipped | event_id=${event.event_id} | event_type=${event.event_type}`
    );
    return;
  }

  switch (event.event_type) {
    case "order.placed": {
      // The product search index is not an orders index. Stock changes for an
      // order are delivered by the accompanying inventory.updated events, so
      // applying them here too would double-count the deduction.
      const orderPayload = event.payload as unknown as OrderPlacedPayload;
      console.log(
        `[ShopSphere Kafka] order.placed received | order_id=${orderPayload.order?.id ?? "unknown"} | items=${orderPayload.items?.length ?? 0} | event_id=${event.event_id}`
      );
      break;
    }

    case "inventory.updated": {
      const invPayload = event.payload as unknown as InventoryUpdatedPayload;
      if (!openSearchAdapter) {
        throw new Error(
          "No OpenSearch adapter configured for inventory.updated"
        );
      }
      await withRetry("inventory search sync", () =>
        openSearchAdapter.applyInventoryUpdated(invPayload)
      );
      console.log(
        `[ShopSphere Kafka] inventory synced to OpenSearch | variant_id=${invPayload.variant_id} | qty_change=${invPayload.quantity_change} | event_id=${event.event_id}`
      );
      break;
    }

    case "product.updated": {
      const prodPayload = event.payload as unknown as ProductUpdatedPayload;
      if (!openSearchAdapter) {
        throw new Error("No OpenSearch adapter configured for product.updated");
      }
      await withRetry("product search sync", () =>
        openSearchAdapter.applyProductUpdated(prodPayload)
      );
      console.log(
        `[ShopSphere Kafka] product re-indexed in OpenSearch | product_uuid=${prodPayload.product?.uuid ?? "unknown"} | event_id=${event.event_id}`
      );
      break;
    }

    default:
      console.warn(
        `[ShopSphere Kafka] Unrecognised event_type="${event.event_type}" | event_id=${event.event_id}. Skipping.`
      );
      // Still mark as processed so we don't retry an unknown type forever.
      break;
  }

  // Record successful processing AFTER all handlers complete.
  await idempotencyStore.markAsProcessed(event.event_id, event.event_type);

  console.log(
    `[ShopSphere Kafka] Event processed | event_id=${event.event_id} | event_type=${event.event_type}`
  );
}

// ---------------------------------------------------------------------------
// Dead-letter handling
// ---------------------------------------------------------------------------

async function handleDeadLetter(
  event: ParsedEvent | null,
  rawMessage: KafkaMessage,
  originalTopic: string,
  err: unknown
): Promise<void> {
  const reason =
    err instanceof Error ? err.message : "Unknown error after max retries";

  console.error(
    "[ShopSphere Kafka] DEAD LETTER — event exhausted all retries.",
    {
      event_id:   event?.event_id   ?? "UNKNOWN",
      event_type: event?.event_type ?? "UNKNOWN",
      originalTopic,
      reason,
    }
  );

  try {
    // publishToDlt is from relay/publisher.ts — the working relay publisher.
    await publishToDlt(
      null,                              // OutboxEventRow not available here
      rawMessage.value?.toString() ?? null,
      reason,
      originalTopic
    );
    console.log(
      `[ShopSphere Kafka] Dead-letter published — offset committed. event_id=${event?.event_id ?? "UNKNOWN"}`
    );
  } catch (dltErr) {
    // Aiven's current plan quota does not allow additional DLT topics. Failing
    // the offset forever would block the partition, so log the raw failure and
    // commit past it. The message remains in the Kafka log for replay.
    console.error(
      "[ShopSphere Kafka] WARNING: DLT topic unavailable; committing offset without dead-lettering.",
      {
        event_id: event?.event_id ?? "UNKNOWN",
        originalTopic,
        dltError: dltErr instanceof Error ? dltErr.message : String(dltErr),
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Main consumer entrypoint
// ---------------------------------------------------------------------------

/**
 * Starts the consumer and subscribes to all three ShopSphere topics.
 *
 * @param idempotencyStore  Production: createPgIdempotencyStore(pool).
 *                          Testing: any in-memory IdempotencyStore.
 * @param openSearchAdapter Concrete SearchSyncAdapter, or null to disable
 *                          indexing (local tests only).
 */
export async function startOrderConsumer(
  idempotencyStore: IdempotencyStore,
  openSearchAdapter: SearchSyncAdapter | null
): Promise<void> {
  const consumer = await getConsumer();
  const config = loadConfig();

  // Subscribe to all three configured topics.
  await consumer.subscribe({
    topics: [
      config.topics.orders,
      config.topics.inventory,
      config.topics.products,
    ],
    // Only consume new events. Replaying an entire topic (including historical
    // inventory deltas) into a fresh consumer group would re-apply stock
    // changes that PostgreSQL already reflects.
    fromBeginning: false,
  });

  console.log(
    `[ShopSphere Kafka] Subscribed to topics: ${config.topics.orders}, ${config.topics.inventory}, ${config.topics.products}`
  );

  await consumer.run({
    // Offsets are committed only after eachMessage resolves without throwing.
    eachMessage: async ({ topic, message }: EachMessagePayload) => {
      const event = parseMessage(message);

      if (!event) {
        // Malformed message — forward to DLT so we can advance past it.
        await handleDeadLetter(
          null,
          message,
          topic,
          new Error("Message failed parsing/validation — see logs above")
        );
        return;
      }

      try {
        await processEvent(event, idempotencyStore, openSearchAdapter);
      } catch (err) {
        await handleDeadLetter(event, message, topic, err);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on("SIGTERM", async () => {
  console.log("[ShopSphere Kafka] SIGTERM received. Shutting down consumer...");
  await disconnectConsumer();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[ShopSphere Kafka] SIGINT received. Shutting down consumer...");
  await disconnectConsumer();
  process.exit(0);
});
