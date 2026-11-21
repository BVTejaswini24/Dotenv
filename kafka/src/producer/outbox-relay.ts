/**
 * outbox-relay.ts
 *
 * Transactional Outbox Relay for ShopSphere.
 *
 * PURPOSE
 * -------
 * This module provides the relay loop that reads unprocessed rows from the
 * PostgreSQL outbox table and publishes them to Kafka.
 *
 * WHY THE OUTBOX PATTERN
 * ----------------------
 * Calling publishOrderPlaced() directly from the Express HTTP handler is
 * unreliable:
 *   - If Kafka is unavailable, the event is lost even though the order committed.
 *   - If the process crashes after the DB commit but before the Kafka send, the
 *     event is never published.
 *
 * The outbox pattern solves this:
 *   1. The backend teammate's Express handler writes both the order row AND an
 *      outbox row in the SAME PostgreSQL transaction.
 *   2. This relay reads unpublished outbox rows and calls publishOrderPlaced().
 *   3. After Kafka confirms delivery, the relay marks the row as published.
 *   4. Result: the event is published if and only if the order was committed.
 *
 * OWNERSHIP
 * ---------
 * This file owns the relay loop logic (steps 2–3).
 * The backend teammate owns the outbox table definition (step 1) and must
 * provide a concrete OutboxStore implementation.
 *
 * REQUIRED BACKEND TEAMMATE ACTION
 * ---------------------------------
 * 1. Create the outbox table:
 *
 *      CREATE TABLE outbox (
 *        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *        event_name   TEXT NOT NULL,
 *        payload      JSONB NOT NULL,
 *        occurred_at  TIMESTAMPTZ NOT NULL,
 *        published_at TIMESTAMPTZ,         -- NULL = not yet published
 *        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *      );
 *
 *    Insert a row in the SAME transaction as the order insert:
 *
 *      INSERT INTO outbox (event_name, payload, occurred_at)
 *      VALUES ('order_placed', $1, NOW());
 *
 *    where $1 is a JSON object matching OrderPlacedPayload.
 *
 * 2. Implement the OutboxStore interface below and pass it to startOutboxRelay().
 *
 * 3. Decide the polling interval. 2–5 seconds is fine for a hackathon.
 *    For production use pg_notify / LISTEN/NOTIFY instead of polling.
 *
 * 4. The relay should run as a separate long-lived process alongside the
 *    Express server, or as a setInterval inside the same process.
 */

import { publishOrderPlaced } from "./order-producer";
import { OrderPlacedPayload } from "../types";

// ---------------------------------------------------------------------------
// OutboxStore interface — implemented by the backend teammate
// ---------------------------------------------------------------------------

export interface OutboxRow {
  /** UUID primary key from the outbox table */
  id: string;

  /** Must be "order_placed" for rows this relay handles */
  eventName: string;

  /**
   * The order payload. Must match OrderPlacedPayload.
   * ⚠️ PROVISIONAL — field names depend on the backend schema.
   */
  payload: OrderPlacedPayload;

  /**
   * ISO 8601 timestamp of when the order was committed.
   * Sourced from the outbox row's occurred_at column.
   */
  occurredAt: string;
}

export interface OutboxStore {
  /**
   * Returns rows from the outbox table where published_at IS NULL,
   * ordered by created_at ASC, limited to a reasonable batch size (e.g. 50).
   */
  fetchUnpublished(): Promise<OutboxRow[]>;

  /**
   * Marks a single outbox row as published by setting published_at = NOW().
   * Called after Kafka confirms delivery of the corresponding message.
   */
  markPublished(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Relay loop
// ---------------------------------------------------------------------------

let _relayRunning = false;
let _relayInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Processes one batch of unpublished outbox rows.
 * Called on each polling tick.
 */
async function processBatch(store: OutboxStore): Promise<void> {
  const rows = await store.fetchUnpublished();

  if (rows.length === 0) return;

  console.log(`[ShopSphere Kafka] Outbox relay: processing ${rows.length} row(s).`);

  for (const row of rows) {
    if (row.eventName !== "order_placed") {
      console.warn(
        `[ShopSphere Kafka] Outbox relay: unknown event_name "${row.eventName}" on row ${row.id}. Skipping.`
      );
      continue;
    }

    try {
      await publishOrderPlaced(row.payload, row.occurredAt);
      await store.markPublished(row.id);
      console.log(
        `[ShopSphere Kafka] Outbox relay: published and marked row ${row.id} | orderId=${row.payload.orderId}`
      );
    } catch (err) {
      // Log and continue to the next row. This row will be retried on the next
      // polling tick because published_at remains NULL.
      // A persistent failure here (e.g. Kafka unreachable) will keep retrying
      // until connectivity is restored — which is the correct at-least-once behaviour.
      console.error(
        `[ShopSphere Kafka] Outbox relay: failed to publish row ${row.id}. Will retry.`,
        { err }
      );
    }
  }
}

/**
 * Starts the outbox relay polling loop.
 *
 * @param store          OutboxStore implementation from the backend teammate.
 * @param intervalMs     Polling interval in milliseconds. Default: 3000 (3s).
 */
export function startOutboxRelay(
  store: OutboxStore,
  intervalMs = 3000
): void {
  if (_relayRunning) {
    console.warn("[ShopSphere Kafka] Outbox relay is already running.");
    return;
  }

  _relayRunning = true;
  console.log(
    `[ShopSphere Kafka] Outbox relay started. Polling every ${intervalMs}ms.`
  );

  _relayInterval = setInterval(async () => {
    try {
      await processBatch(store);
    } catch (err) {
      // Unexpected error in processBatch (e.g. DB connection lost).
      // Log and keep the loop running — the relay will retry on the next tick.
      console.error("[ShopSphere Kafka] Outbox relay: unexpected error in batch.", { err });
    }
  }, intervalMs);
}

/**
 * Stops the outbox relay polling loop.
 * Call this during process shutdown.
 */
export function stopOutboxRelay(): void {
  if (_relayInterval) {
    clearInterval(_relayInterval);
    _relayInterval = null;
    _relayRunning = false;
    console.log("[ShopSphere Kafka] Outbox relay stopped.");
  }
}
