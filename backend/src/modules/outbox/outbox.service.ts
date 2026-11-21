import { randomUUID } from "node:crypto";
import { pool } from "../../db/pool";

/**
 * Transactional outbox helpers.
 *
 * The API only *writes* events, inside the same transaction as the business
 * change. Publishing to Kafka is Member 3's job; this module gives them a
 * documented, safe way to do it without touching order code.
 */

export type OutboxClient = {
  query: (
    text: string,
    values?: unknown[]
  ) => Promise<{ rows: Record<string, unknown>[] }>;
};

export type OutboxEventType =
  | "order.placed"
  | "inventory.updated"
  | "product.updated";

export type OutboxEventInput = {
  type: OutboxEventType;
  aggregateType: "order" | "product" | "product_variant";
  aggregateId: string;
  payload: Record<string, unknown>;
  eventVersion?: number;
};

/**
 * Inserts an event and returns its id. The id is generated here so it can also
 * be embedded in the payload (`event_id`), matching the documented contract.
 */
export async function insertOutboxEvent(
  client: OutboxClient,
  input: OutboxEventInput
): Promise<{ id: string }> {
  const id = randomUUID();
  const payload = { ...input.payload, event_id: id };

  await client.query(
    `INSERT INTO outbox_events
       (id, event_type, aggregate_type, aggregate_id, payload, event_version)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      input.type,
      input.aggregateType,
      input.aggregateId,
      JSON.stringify(payload),
      input.eventVersion ?? 1,
    ]
  );

  return { id };
}

export type OutboxEventRow = {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  event_version: number;
  payload: Record<string, unknown>;
  attempts: number;
};

/**
 * Member 3's relay entry point.
 *
 * Claims up to `limit` pending events with `FOR UPDATE SKIP LOCKED`, hands each
 * one to `publish`, then marks it published — all inside one transaction. If
 * `publish` throws, the transaction is rolled back, `attempts`/`last_error` are
 * recorded and the event stays pending for a retry with backoff.
 */
export async function runOutboxBatch(
  publish: (event: OutboxEventRow) => Promise<void>,
  limit = 50
): Promise<{ published: number; failed: number }> {
  const client = await pool.connect();
  let published = 0;
  let failed = 0;

  try {
    await client.query("BEGIN");
    const { rows } = await client.query<OutboxEventRow>(
      `SELECT id, event_type, aggregate_type, aggregate_id,
              event_version, payload, attempts
         FROM outbox_events
        WHERE status = 'pending' AND available_at <= now()
        ORDER BY created_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [limit]
    );

    for (const event of rows) {
      try {
        await publish(event);
        await client.query(
          `UPDATE outbox_events
              SET status = 'published', published_at = now(), last_error = NULL
            WHERE id = $1`,
          [event.id]
        );
        published += 1;
      } catch (error) {
        await client.query(
          `UPDATE outbox_events
              SET attempts = attempts + 1,
                  last_error = $2,
                  available_at = now()
                    + (interval '1 second' * LEAST(300, (2 ^ attempts)))
            WHERE id = $1`,
          [event.id, (error as Error).message.slice(0, 500)]
        );
        failed += 1;
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return { published, failed };
}

/** Read-only view for debugging / the integration docs. */
export async function listOutboxEvents(status: string | null, limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, event_type, aggregate_type, aggregate_id, event_version,
            status, attempts, available_at, published_at, last_error, created_at
       FROM outbox_events
      WHERE ($1::text IS NULL OR status = $1)
      ORDER BY created_at DESC
      LIMIT $2`,
    [status, limit]
  );
  return rows;
}
