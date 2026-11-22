/**
 * relay/worker.ts
 *
 * Process entry point for the ShopSphere outbox relay.
 *
 * DOTENV LOAD ORDER
 * -----------------
 * This project uses CommonJS (tsconfig: "module": "commonjs"). In CommonJS,
 * require() calls execute at the point they appear in the file. This means
 * dotenv can be loaded via require() BEFORE the import statements that depend
 * on environment variables are evaluated.
 *
 * We use require() for dotenv so the env vars are populated before
 * backend/src/config/env.ts is first required (which would throw if
 * DATABASE_URL, JWT_SECRET etc. are missing).
 *
 * DO NOT start this worker without backend/.env and kafka/.env populated.
 * This process will connect to the live Aiven PostgreSQL and Kafka.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path") as typeof import("path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require("dotenv") as typeof import("dotenv");

// Load backend environment first (DATABASE_URL, JWT_SECRET, etc.)
dotenv.config({ path: path.resolve(__dirname, "../../backend/.env") });

// Load Kafka environment (KAFKA_BROKERS, KAFKA_SSL_CA, etc.)
// dotenv.config does not overwrite already-set variables, so if both files
// define the same key, the backend value wins.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Now safe to import modules that read process.env at import time.
import { startOutboxRelay, stopOutboxRelay } from "./outbox-relay";

// ---- Relay start ----
startOutboxRelay();

// ---- Graceful shutdown ----
const shutdown = (): void => {
  console.log("[ShopSphere Kafka] Shutdown signal received — stopping relay.");
  stopOutboxRelay();
  // The producer singleton inside publisher.ts will close when the process exits.
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
