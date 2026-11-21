import { Pool } from "pg";
import { env } from "../config/env";

/**
 * Aiven PostgreSQL requires SSL.
 *
 * For hackathon speed we set `rejectUnauthorized: false` when DATABASE_SSL=true.
 * For production, download the Aiven CA certificate and pass it as `ca`
 * instead of disabling certificate verification.
 */
const ssl = env.databaseSsl ? { rejectUnauthorized: false } : undefined;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (error) => {
  console.error("[db] Unexpected error on idle PostgreSQL client:", error);
});
