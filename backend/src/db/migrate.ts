import fs from "node:fs";
import path from "node:path";
import type { PoolClient } from "pg";
import { pool } from "./pool";

export const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const DOWN_DIR = path.join(MIGRATIONS_DIR, "down");

async function ensureMigrationsTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export function listMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

/** Applies every migration that has not run yet. Safe to call repeatedly. */
export async function applyMigrations(client: PoolClient): Promise<string[]> {
  const applied: string[] = [];
  await ensureMigrationsTable(client);

  for (const file of listMigrationFiles()) {
    const alreadyApplied = await client.query(
      "SELECT 1 FROM schema_migrations WHERE id = $1",
      [file]
    );
    if ((alreadyApplied.rowCount ?? 0) > 0) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
      applied.push(file);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  return applied;
}

/** Rolls back one migration using migrations/down/<id>. */
export async function rollbackMigration(
  client: PoolClient,
  id: string
): Promise<void> {
  const downPath = path.join(DOWN_DIR, id);
  if (!fs.existsSync(downPath)) {
    throw new Error(`No rollback file for migration: ${id}`);
  }

  await ensureMigrationsTable(client);
  const sql = fs.readFileSync(downPath, "utf8");

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("DELETE FROM schema_migrations WHERE id = $1", [id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const client = await pool.connect();

  try {
    if (args[0] === "--rollback") {
      const target = args[1];

      if (target === "--all") {
        const { rows } = await client.query<{ id: string }>(
          "SELECT id FROM schema_migrations ORDER BY id DESC"
        );
        for (const row of rows) {
          await rollbackMigration(client, row.id);
          console.log(`[migrate] rolled back ${row.id}`);
        }
        console.log("[migrate] All migrations rolled back.");
        return;
      }

      const files = target
        ? [target]
        : listMigrationFiles().slice(-1); // default: the latest migration
      for (const file of files) {
        await rollbackMigration(client, file);
        console.log(`[migrate] rolled back ${file}`);
      }
      return;
    }

    const applied = await applyMigrations(client);
    for (const file of applied) {
      console.log(`[migrate] applied ${file}`);
    }
    console.log(
      applied.length === 0
        ? "[migrate] All migrations are up to date."
        : `[migrate] Applied ${applied.length} migration(s).`
    );
  } finally {
    client.release();
  }
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error("[migrate] Failed:", error instanceof Error ? error.message : error);
    await pool.end().catch(() => undefined);
    process.exitCode = 1;
  });
