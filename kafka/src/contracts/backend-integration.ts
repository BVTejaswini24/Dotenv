/**
 * backend-integration.ts
 *
 * Integration contract between the ShopSphere Kafka module and the
 * Express + PostgreSQL backend.
 *
 * OWNER: Kafka module (read-only reference for the backend teammate).
 *
 * This file defines the exact TypeScript interfaces the backend teammate
 * must implement to connect the Express backend to the Kafka module.
 * It does NOT implement any database logic — that belongs to the backend.
 *
 * SHARE THIS FILE with the backend teammate.
 * They implement the interfaces; we consume them.
 */

import { OrderPlacedPayload } from "../types";

// ---------------------------------------------------------------------------
// 1. IdempotencyStore
//    Prevents the consumer from processing the same event twice.
//    Used in: kafka/src/consumer/order-consumer.ts
// ---------------------------------------------------------------------------

/**
 * The backend teammate must implement this interface backed by the
 * processed_events PostgreSQL table.
 *
 * Required table (create once, owned by backend):
 *
 *   CREATE TABLE processed_events (
 *     event_id     TEXT PRIMARY KEY,
 *     processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *
 * Example implementation (pseudo-code for Express/pg):
 *
 *   class PgIdempotencyStore implements IdempotencyStore {
 *     constructor(private db: Pool) {}
 *
 *     async hasBeenProcessed(eventId: string): Promise<boolean> {
 *       const { rowCount } = await this.db.query(
 *         'SELECT 1 FROM processed_events WHERE event_id = $1',
 *         [eventId]
 *       );
 *       return (rowCount ?? 0) > 0;
 *     }
 *
 *     async markAsProcessed(eventId: string): Promise<void> {
 *       await this.db.query(
 *         'INSERT INTO processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING',
 *         [eventId]
 *       );
 *     }
 *   }
 *
 * ATOMICITY NOTE:
 * For the OpenSearch handler the side effect is an idempotent upsert, so
 * a simple INSERT after the fact is safe.
 * If you add non-idempotent handlers (e.g. sending emails), the
 * markAsProcessed INSERT must run inside the same DB transaction as the
 * handler's side effect.
 */
export interface IdempotencyStoreContract {
  hasBeenProcessed(eventId: string): Promise<boolean>;
  markAsProcessed(eventId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// 2. OutboxStore
//    Enables reliable event publishing via the transactional outbox pattern.
//    Used in: kafka/src/producer/outbox-relay.ts
// ---------------------------------------------------------------------------

/**
 * The backend teammate must implement this interface backed by the
 * outbox PostgreSQL table.
 *
 * Required table (create once, owned by backend):
 *
 *   CREATE TABLE outbox (
 *     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     event_name   TEXT NOT NULL,
 *     payload      JSONB NOT NULL,
 *     occurred_at  TIMESTAMPTZ NOT NULL,
 *     published_at TIMESTAMPTZ,         -- NULL = unpublished
 *     created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *
 * The backend teammate inserts into this table inside the SAME transaction
 * as the order insert:
 *
 *   -- Inside the order transaction:
 *   INSERT INTO orders (...) VALUES (...);
 *   INSERT INTO outbox (event_name, payload, occurred_at)
 *   VALUES ('order_placed', $payload::jsonb, NOW());
 *   COMMIT;
 *
 * Where $payload is a JSON object with the fields from OrderPlacedPayload
 * (see kafka/src/types.ts — confirm all ⚠️ PROVISIONAL fields).
 *
 * Example implementation (pseudo-code):
 *
 *   class PgOutboxStore implements OutboxStoreContract {
 *     constructor(private db: Pool) {}
 *
 *     async fetchUnpublished() {
 *       const { rows } = await this.db.query(
 *         `SELECT id, event_name, payload, occurred_at
 *          FROM outbox WHERE published_at IS NULL
 *          ORDER BY created_at ASC LIMIT 50`
 *       );
 *       return rows.map(r => ({
 *         id: r.id,
 *         eventName: r.event_name,
 *         payload: r.payload,
 *         occurredAt: r.occurred_at.toISOString(),
 *       }));
 *     }
 *
 *     async markPublished(id: string) {
 *       await this.db.query(
 *         'UPDATE outbox SET published_at = NOW() WHERE id = $1',
 *         [id]
 *       );
 *     }
 *   }
 */
export interface OutboxStoreContract {
  fetchUnpublished(): Promise<Array<{
    id: string;
    eventName: string;
    payload: OrderPlacedPayload;
    occurredAt: string;
  }>>;
  markPublished(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// 3. Event payload contract (what the backend puts in the outbox payload)
// ---------------------------------------------------------------------------

/**
 * The backend teammate must populate the outbox payload with these fields.
 * All fields are currently PROVISIONAL — confirm before finalising.
 *
 * Re-exported from types.ts for convenience.
 */
export type { OrderPlacedPayload };

/**
 * QUESTIONS FOR THE BACKEND TEAMMATE
 * ------------------------------------
 * Please confirm the following so the Kafka module can finalise types.ts:
 *
 * 1. orderId     — string (UUID) or number (integer)?
 * 2. customerId  — string (UUID) or number? Field name in your schema?
 * 3. totalAmount — decimal number (e.g. 299.99) or integer cents (e.g. 29999)?
 * 4. status      — what string is set when an order is first created?
 *                  Frontend uses "confirmed". Does your DB use the same?
 * 5. items[].productId  — string (UUID) or number?
 *                         Frontend CartItem.id is number. Is this the same field?
 * 6. items[].unitPrice  — decimal or cents?
 *
 * The frontend Order type (src/lib/features/orders/ordersSlice.ts) uses:
 *   orderNumber: string   ← is this your orderId?
 *   userId: string        ← is this your customerId?
 *   total: number         ← decimal, e.g. 299.99
 *   status: "confirmed"   ← as first status
 *   items: CartItem[]     ← CartItem.id: number, CartItem.price: number (decimal)
 *
 * Share your answers and we will update types.ts together.
 */
