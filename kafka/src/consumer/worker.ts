/**
 * consumer/worker.ts
 *
 * Process entry point for the ShopSphere Kafka consumer.
 *
 * Wires the real production dependencies:
 *   - PostgreSQL-backed processed_events idempotency ledger
 *   - OpenSearch product sync adapter
 *
 * Environment is loaded before any module that reads process.env at import
 * time. backend/.env is read first (DATABASE_URL/JWT_SECRET), then kafka/.env
 * (Kafka/OpenSearch credentials); dotenv never overwrites existing keys.
 *
 * Do not run this against production without intending to consume events.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path") as typeof import("path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require("dotenv") as typeof import("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../../backend/.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { Pool } from "pg";
import { startOrderConsumer, disconnectConsumer } from "./order-consumer";
import { createPgIdempotencyStore } from "./pg-idempotency-store";
import {
  createProductSyncStore,
  OpenSearchProductAdapter,
} from "../opensearch/product-sync";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.trim() === "") {
  throw new Error(
    "[ShopSphere Kafka] Missing DATABASE_URL for the consumer idempotency store."
  );
}

const useSsl = (process.env.DATABASE_SSL ?? "false").toLowerCase() === "true";
const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 5,
  application_name: "shopsphere-kafka-consumer",
});

const idempotencyStore = createPgIdempotencyStore(pool);
const productSyncStore = createProductSyncStore();
const adapter = new OpenSearchProductAdapter(productSyncStore);

async function main(): Promise<void> {
  console.log("[ShopSphere Kafka] Starting consumer with PostgreSQL + OpenSearch.");
  await startOrderConsumer(idempotencyStore, adapter);
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[ShopSphere Kafka] ${signal} received. Shutting down consumer...`);
  await disconnectConsumer().catch(() => undefined);
  await productSyncStore.close().catch(() => undefined);
  await pool.end().catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  console.error("[ShopSphere Kafka] Consumer failed to start.", error);
  process.exit(1);
});
