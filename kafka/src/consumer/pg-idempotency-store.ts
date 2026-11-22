/**
 * consumer/pg-idempotency-store.ts
 *
 * PostgreSQL-backed implementation of IdempotencyStore.
 *
 * Uses the backend's existing processed_events table (created in migration
 * 002_extend_schema.sql). No new table, no new pool — reuses the backend's
 * exported `pool` from backend/src/db/pool.ts.
 *
 * ACTUAL SCHEMA (from 002_extend_schema.sql):
 *   CREATE TABLE processed_events (
 *     consumer     TEXT NOT NULL,
 *     event_id     UUID NOT NULL,
 *     event_type   TEXT,
 *     processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 *     PRIMARY KEY (consumer, event_id)
 *   );
 *
 * The PRIMARY KEY is composite: (consumer, event_id).
 * This allows multiple consumers to track the same event_id independently.
 *
 * DOTENV ORDERING: This file must only be imported AFTER dotenv has been
 * loaded (i.e. after backend/.env is read). The worker entry point guarantees
 * this by calling dotenv.config() before any imports.
 *
 * IDEMPOTENCY CORRECTNESS:
 * - OpenSearch writes are idempotent by document ID, so the check-then-mark
 *   sequence is safe even if the consumer crashes between the two steps.
 * - For non-idempotent side effects, the INSERT into processed_events must
 *   share a transaction with the side effect. OpenSearch is not transactional,
 *   so we insert after the OpenSearch call completes successfully.
 */

/** Stable consumer identifier — must not change across restarts. */
export const CONSUMER_ID = "shopsphere-kafka-worker";

export interface IdempotencyStore {
  hasBeenProcessed(eventId: string, eventType: string): Promise<boolean>;
  markAsProcessed(eventId: string, eventType: string): Promise<void>;
}

/**
 * Minimal pool interface matching the backend pg Pool (backend/src/db/pool.ts).
 */
export interface PgPool {
  query: (
    text: string,
    values?: unknown[]
  ) => Promise<{ rowCount?: number | null; rows?: unknown[] }>;
}

/**
 * Creates a PostgreSQL-backed IdempotencyStore.
 *
 * @param pool  The pg Pool exported from backend/src/db/pool.ts.
 *              Lazily injected so this module can be imported before the
 *              backend pool is initialised.
 */
export function createPgIdempotencyStore(pool: PgPool): IdempotencyStore {
  return {
    async hasBeenProcessed(eventId: string): Promise<boolean> {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM processed_events
          WHERE consumer = $1 AND event_id = $2`,
        [CONSUMER_ID, eventId]
      );
      return (rowCount ?? 0) > 0;
    },

    async markAsProcessed(eventId: string, eventType: string): Promise<void> {
      await pool.query(
        `INSERT INTO processed_events (consumer, event_id, event_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (consumer, event_id) DO NOTHING`,
        [CONSUMER_ID, eventId, eventType]
      );
    },
  };
}
