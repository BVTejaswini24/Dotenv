import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

/**
 * Windows sometimes leaves an embedded-postgres child alive after a hard stop;
 * the orphan keeps the shared memory segment, which makes the next initdb fail.
 * Only processes running the project-local embedded binary are touched.
 */
function killLeftoverEmbeddedPostgres() {
  if (process.platform !== "win32") return;
  try {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | Where-Object { $_.CommandLine -like '*@embedded-postgres*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
      ],
      { stdio: "ignore", timeout: 20_000 }
    );
  } catch {
    // best effort only
  }
}

/**
 * Starts a real PostgreSQL instance for the test suite.
 *
 * - If TEST_DATABASE_URL is set, that database is used instead (never point it
 *   at production: the suite writes and deletes rows).
 * - Otherwise a throwaway embedded PostgreSQL is created in backend/.pgdata-test
 *   on port 55432 and removed by the teardown.
 */
const EMBEDDED_PORT = 55432;
const EMBEDDED_USER = "shopsphere";
const EMBEDDED_PASSWORD = "shopsphere";
const EMBEDDED_DB = "shopsphere_test";

export default async function setup(project: TestProject) {
  const migrationsDir = path.resolve(process.cwd(), "migrations");
  const providedUrl = process.env.TEST_DATABASE_URL;
  let stopServer: (() => Promise<void>) | null = null;

  let databaseUrl: string;
  if (providedUrl) {
    databaseUrl = providedUrl;
  } else {
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    killLeftoverEmbeddedPostgres();
    // A per-run directory avoids colliding with any stale shared memory segment.
    const dataDir = path.resolve(process.cwd(), ".pgdata-test", String(process.pid));
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.mkdirSync(dataDir, { recursive: true });

    const pg = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: EMBEDDED_USER,
      password: EMBEDDED_PASSWORD,
      port: EMBEDDED_PORT,
      persistent: false,
    });

    await pg.initialise();
    await pg.start();
    await pg.createDatabase(EMBEDDED_DB);
    stopServer = async () => {
      await pg.stop();
    };

    databaseUrl = `postgres://${EMBEDDED_USER}:${EMBEDDED_PASSWORD}@127.0.0.1:${EMBEDDED_PORT}/${EMBEDDED_DB}`;
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    for (const file of fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      const done = await client.query(
        "SELECT 1 FROM schema_migrations WHERE id = $1",
        [file]
      );
      if ((done.rowCount ?? 0) > 0) continue;

      await client.query("BEGIN");
      await client.query(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
    }

    const { seedCatalog } = await import("../src/db/seed");
    const seeded = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM products");
    if (Number(seeded.rows[0].count) === 0) {
      await client.query("BEGIN");
      const result = await seedCatalog(client as never);
      await client.query("COMMIT");
      console.log(
        `[test] seeded ${result.products} products, ${result.variants} variants`
      );
    }
  } finally {
    await client.end().catch(() => undefined);
  }

  // Available to tests through inject("databaseUrl") if needed.
  project.provide("databaseUrl", databaseUrl);

  return async () => {
    if (stopServer) {
      await stopServer().catch(() => undefined);
      killLeftoverEmbeddedPostgres();
    }
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
