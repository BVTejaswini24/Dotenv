/**
 * outbox-relay.ts
 *
 * Outbox relay loop for ShopSphere.
 *
 * Uses the backend's existing runOutboxBatch() as the sole outbox source.
 * This module does NOT create a second outbox implementation.
 *
 * HOW IT WORKS
 * ------------
 * 1. runOutboxBatch() opens a PostgreSQL transaction using the backend's pool.
 * 2. It claims up to BATCH_SIZE pending rows with FOR UPDATE SKIP LOCKED.
 * 3. For each row it calls our publish callback (publishOutboxEvent).
 * 4. On success: marks the row published and commits.
 * 5. On failure: increments attempts, records last_error, schedules backoff, commits.
 *
 * The backend pool is reused — no duplicate PostgreSQL connection is created.
 *
 * ENVIRONMENT REQUIREMENT
 * -----------------------
 * The caller (worker.ts) loads backend/.env and kafka/.env before starting
 * the relay.
 *
 * SAFE CONCURRENCY
 * ----------------
 * FOR UPDATE SKIP LOCKED means multiple relay instances can run safely in
 * parallel without double-publishing the same row.
 */

import { publishOutboxEvent } from "./publisher";
import { validateOutboxPayload, OutboxEventRow } from "../types";

export type RunOutboxBatchFn = (
  publish: (event: OutboxEventRow) => Promise<void>,
  limit?: number
) => Promise<{ published: number; failed: number }>;

let _runOutboxBatch: RunOutboxBatchFn | null = null;

/**
 * Lazily loads the backend's runOutboxBatch function.
 * Avoids cross-root compilation issues in TypeScript while directly reusing
 * backend/src/modules/outbox/outbox.service.ts at runtime.
 */
export function getRunOutboxBatch(): RunOutboxBatchFn {
  if (!_runOutboxBatch) {
    // Dynamically require backend's runOutboxBatch at runtime to avoid
    // cross-project rootDir compilation issues in Kafka's tsconfig
    // while reusing backend's exact outbox implementation.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("../../../backend/src/modules/outbox/outbox.service");
    _runOutboxBatch = mod.runOutboxBatch;
  }
  return _runOutboxBatch!;
}

/**
 * Injects a custom runOutboxBatch runner (useful for testing).
 */
export function setRunOutboxBatch(fn: RunOutboxBatchFn | null): void {
  _runOutboxBatch = fn;
}

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 3_000;

let _running = false;
let _interval: ReturnType<typeof setInterval> | null = null;

/**
 * Processes one batch: delegates entirely to runOutboxBatch().
 * Our only responsibility is the publish callback.
 */
export async function runBatch(): Promise<{ published: number; failed: number }> {
  const runner = getRunOutboxBatch();
  const { published, failed } = await runner(async (event) => {
    // Validate payload shape before attempting to publish.
    const validationError = validateOutboxPayload(event.event_type, event.payload);
    if (validationError) {
      // Throw so runOutboxBatch records the failure and schedules a retry.
      throw new Error(`Payload validation failed: ${validationError}`);
    }

    await publishOutboxEvent(event);
  }, BATCH_SIZE);

  if (published > 0 || failed > 0) {
    console.log(
      `[ShopSphere Kafka] Outbox batch: published=${published} failed=${failed}`
    );
  }

  return { published, failed };
}

/**
 * Starts the relay polling loop.
 * Safe to call once per process — a second call is a no-op.
 */
export function startOutboxRelay(): void {
  if (_running) {
    console.warn("[ShopSphere Kafka] Outbox relay already running.");
    return;
  }

  _running = true;
  console.log(
    `[ShopSphere Kafka] Outbox relay started. Polling every ${POLL_INTERVAL_MS}ms.`
  );

  _interval = setInterval(async () => {
    try {
      await runBatch();
    } catch (err) {
      // Unexpected error (e.g. DB connection lost).
      // Log and keep the loop alive — the next tick will retry.
      console.error("[ShopSphere Kafka] Outbox relay: unexpected batch error.", { err });
    }
  }, POLL_INTERVAL_MS);
}

/**
 * Stops the relay polling loop.
 * Call during graceful shutdown.
 */
export function stopOutboxRelay(): void {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
    _running = false;
    console.log("[ShopSphere Kafka] Outbox relay stopped.");
  }
}
