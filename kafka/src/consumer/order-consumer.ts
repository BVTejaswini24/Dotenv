/**
 * order-consumer.ts
 *
 * Subscribes to the order_placed Kafka topic and dispatches each event
 * to the registered handlers asynchronously.
 *
 * RETRY AND ERROR HANDLING STRATEGY
 * -----------------------------------
 * Each handler is retried up to MAX_RETRIES times with exponential backoff.
 * A failed message is NEVER silently acknowledged or marked as processed.
 *
 * Dead-letter strategy (implemented):
 *   - After all retries are exhausted, the raw message is forwarded to the
 *     dead-letter topic (order_placed.DLT) via publishToDlt().
 *   - The DLT topic must be pre-created in the Aiven console.
 *   - If the DLT publish also fails, the consumer halts at that offset
 *     (does not commit), so the message is re-delivered on restart.
 *   - The consumer logs all dead-letter events for manual inspection.
 *
 * IDEMPOTENCY — IMPORTANT CORRECTNESS NOTE
 * ------------------------------------------
 * This consumer performs an idempotency check using IdempotencyStore before
 * processing each event. HOWEVER, a check-then-process sequence alone does NOT
 * guarantee exactly-once processing:
 *
 *   - If the consumer crashes between processing and recording the eventId,
 *     the event will be re-delivered and processed again.
 *   - True duplicate safety requires either:
 *       A) Atomicity between the side effect and the processed_events record
 *          (e.g., both inside a single PostgreSQL transaction), OR
 *       B) Naturally idempotent side effects (e.g., OpenSearch upsert by orderId).
 *
 * The IdempotencyStore interface below is a placeholder. The backend teammate
 * must provide the durable implementation backed by PostgreSQL.
 *
 * INTERFACE POINTS REQUIRING BACKEND TEAMMATE CONFIRMATION
 * ---------------------------------------------------------
 * 1. The processed_events table definition:
 *      CREATE TABLE processed_events (
 *        event_id    TEXT PRIMARY KEY,
 *        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *      );
 * 2. Whether the consumer gets a direct DB connection or calls a backend API.
 * 3. For non-idempotent handlers: whether the side effect and the
 *    processed_events INSERT can be wrapped in the same transaction.
 */

import {
  Consumer,
  EachMessagePayload,
  Kafka,
  KafkaMessage,
} from "kafkajs";
import { createKafkaClient } from "../kafka-client";
import { loadConfig } from "../config";
import { OrderPlacedEvent, validateOrderPlacedEvent } from "../types";
import { publishToDlt } from "../producer/order-producer";
import {
  handleOrderPlacedForSearch,
  OpenSearchAdapter,
} from "./handlers/search-sync.handler";

// ---------------------------------------------------------------------------
// Idempotency interface — to be implemented by backend teammate
// ---------------------------------------------------------------------------

/**
 * Durable store for recording processed event IDs.
 *
 * The backend teammate must provide a concrete implementation backed by
 * PostgreSQL. An in-memory implementation is NOT acceptable for production
 * because it does not survive restarts and does not provide atomicity with
 * database side effects.
 *
 * See correctness note in the file header above.
 * See kafka/src/contracts/backend-integration.ts for the exact interface contract.
 */
export interface IdempotencyStore {
  /**
   * Returns true if this eventId has already been successfully processed.
   * Must query a durable store (PostgreSQL processed_events table).
   */
  hasBeenProcessed(eventId: string): Promise<boolean>;

  /**
   * Records that this eventId was successfully processed.
   * For non-idempotent handlers, this MUST be atomic with the handler's
   * side effect (same DB transaction). Coordinate with the backend teammate.
   */
  markAsProcessed(eventId: string): Promise<void>;
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

  _consumer = _kafka.consumer({
    groupId: config.groupId,
  });

  await _consumer.connect();
  console.log(
    `[ShopSphere Kafka] Consumer connected | groupId=${config.groupId}`
  );
  return _consumer;
}

/**
 * Gracefully disconnects the consumer.
 * Call this during process shutdown (SIGTERM/SIGINT).
 */
export async function disconnectConsumer(): Promise<void> {
  if (_consumer) {
    await _consumer.disconnect();
    _consumer = null;
    console.log("[ShopSphere Kafka] Consumer disconnected.");
  }
}

// ---------------------------------------------------------------------------
// Message parsing and validation
// ---------------------------------------------------------------------------

/**
 * Parses and validates an incoming Kafka message.
 * Returns the typed event on success, or null if the message is malformed.
 * Logs a detailed error including the validation failure reason.
 */
function parseMessage(message: KafkaMessage): OrderPlacedEvent | null {
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

  // Run structural + field-level validation.
  const validationError = validateOrderPlacedEvent(parsed);
  if (validationError) {
    console.error(
      `[ShopSphere Kafka] Message failed validation: ${validationError}`,
      { raw: message.value.toString() }
    );
    return null;
  }

  return parsed as OrderPlacedEvent;
}

// ---------------------------------------------------------------------------
// Handler dispatch with retry
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
      delayMs *= 2; // exponential backoff
    }
  }
}

// ---------------------------------------------------------------------------
// Per-message processor
// ---------------------------------------------------------------------------

async function processMessage(
  event: OrderPlacedEvent,
  idempotencyStore: IdempotencyStore,
  openSearchAdapter: OpenSearchAdapter | null
): Promise<void> {
  // Idempotency check — see correctness note in the file header.
  const alreadyProcessed = await idempotencyStore.hasBeenProcessed(event.eventId);
  if (alreadyProcessed) {
    console.log(
      `[ShopSphere Kafka] Duplicate event skipped | eventId=${event.eventId} | orderId=${event.payload.orderId}`
    );
    return;
  }

  if (openSearchAdapter) {
    await withRetry("search-sync.handler", () =>
      handleOrderPlacedForSearch(event, openSearchAdapter)
    );
  } else {
    console.warn(
      `[ShopSphere Kafka] No OpenSearchAdapter provided. OpenSearch sync skipped for eventId=${event.eventId}.`
    );
  }

  // Record successful processing AFTER all handlers complete.
  // NOTE: For non-idempotent handlers this must be atomic with the handler's
  // DB side effect. See IdempotencyStore documentation above.
  await idempotencyStore.markAsProcessed(event.eventId);

  console.log(
    `[ShopSphere Kafka] Event processed | eventId=${event.eventId} | orderId=${event.payload.orderId}`
  );
}

// ---------------------------------------------------------------------------
// Dead-letter handling
// ---------------------------------------------------------------------------

/**
 * Attempts to publish the failed message to the DLT, then throws to prevent
 * the offset from being committed.
 *
 * If the DLT publish succeeds: the offset IS committed (we return normally)
 * so the consumer can advance past the poison message without halting.
 *
 * If the DLT publish fails: we still throw so the offset is NOT committed.
 * The consumer halts at this message until the DLT topic is available or
 * the underlying cause is fixed.
 */
async function handleDeadLetter(
  event: OrderPlacedEvent | null,
  rawMessage: KafkaMessage,
  originalTopic: string,
  err: unknown
): Promise<void> {
  const reason =
    err instanceof Error ? err.message : "Unknown error after max retries";

  console.error(
    "[ShopSphere Kafka] DEAD LETTER — event exhausted all retries.",
    {
      eventId: event?.eventId ?? "UNKNOWN",
      orderId: event?.payload?.orderId ?? "UNKNOWN",
      reason,
    }
  );

  try {
    await publishToDlt(rawMessage.value, reason, originalTopic);
    // DLT publish succeeded — log and return normally so the offset is committed.
    // The consumer can safely advance to the next message.
    console.log(
      `[ShopSphere Kafka] Dead-letter handled — offset will be committed. eventId=${event?.eventId ?? "UNKNOWN"}`
    );
  } catch (dltErr) {
    // DLT publish also failed. Do not commit the offset.
    // The consumer will halt here until the DLT topic is available.
    console.error(
      "[ShopSphere Kafka] CRITICAL: Failed to publish to DLT. Offset NOT committed. Consumer halted.",
      { dltErr }
    );
    throw err; // throw the original processing error
  }
}

// ---------------------------------------------------------------------------
// Main consumer entrypoint
// ---------------------------------------------------------------------------

/**
 * Starts the order_placed consumer.
 *
 * @param idempotencyStore  Durable idempotency adapter (backend teammate provides this).
 *                          Use noopIdempotencyStore from test scripts for Aiven testing only.
 * @param openSearchAdapter OpenSearch adapter (Teammate 2 provides this). Pass null
 *                          to skip OpenSearch sync until the contract is agreed.
 */
export async function startOrderConsumer(
  idempotencyStore: IdempotencyStore,
  openSearchAdapter: OpenSearchAdapter | null
): Promise<void> {
  const consumer = await getConsumer();
  const config = loadConfig();

  await consumer.subscribe({
    topic: config.topics.orderPlaced,
    fromBeginning: true,
  });

  console.log(
    `[ShopSphere Kafka] Subscribed to topic: ${config.topics.orderPlaced}`
  );

  await consumer.run({
    // Offsets are committed only after eachMessage resolves without throwing.
    // If this function throws, the offset is NOT committed and Kafka re-delivers.
    eachMessage: async ({ topic, message }: EachMessagePayload) => {
      const event = parseMessage(message);

      if (!event) {
        // Malformed or invalid message — send to DLT so we can advance past it.
        // If DLT is unavailable this throws, halting the consumer at this offset.
        await handleDeadLetter(
          null,
          message,
          topic,
          new Error("Message failed parsing/validation — see logs above for details")
        );
        return;
      }

      try {
        await processMessage(event, idempotencyStore, openSearchAdapter);
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
