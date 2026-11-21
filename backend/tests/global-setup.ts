import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
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

const EMBEDDED_USER = "shopsphere";
const EMBEDDED_PASSWORD = "shopsphere";
const EMBEDDED_DB = "shopsphere_test";
const CANDIDATE_PORTS = [55432, 55433, 55434, 55435, 55436];

/** Written for setup-env.ts, which runs in the test workers after this file. */
const INFO_PATH = path.resolve(process.cwd(), "tests", ".test-database.json");

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen({ host: "127.0.0.1", port, exclusive: true });
  });
}

/**
 * Retries because Windows antivirus/OneDrive can briefly hold the port or the
 * freshly initialised data directory (EACCES/EPERM on connect).
 */
async function connectWithRetry(
  connectionString: string,
  attempts = 10
): Promise<Client> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  const code = (lastError as NodeJS.ErrnoException | undefined)?.code;
  const hint =
    code === "EACCES"
      ? " Windows returned EACCES: check antivirus/OneDrive folder protection, or run the tests from a local (non-synced) path."
      : "";
  throw new Error(
    `Could not connect to the test PostgreSQL database (${code ?? "unknown"}).${hint}`,
    { cause: lastError }
  );
}

/**
 * Starts a real PostgreSQL instance for the test suite.
 *
 * - If TEST_DATABASE_URL is set, that database is used instead (never point it
 *   at production: the suite writes and deletes rows).
 * - Otherwise a throwaway embedded PostgreSQL is created under
 *   backend/.pgdata-test and removed by the teardown. Ports are tried in order
 *   so a stale process or a Windows EACCES on one port does not fail the run.
 */
export default async function setup(project: TestProject) {
  const migrationsDir = path.resolve(process.cwd(), "migrations");
  const providedUrl = process.env.TEST_DATABASE_URL;
  let stopServer: (() => Promise<void>) | null = null;

  let databaseUrl: string;
  if (providedUrl) {
    databaseUrl = providedUrl;
  } else {
    killLeftoverEmbeddedPostgres();
    const { default: EmbeddedPostgres } = await import("embedded-postgres");

    let started = false;
    let lastError: unknown = null;

    for (const port of CANDIDATE_PORTS) {
      if (!(await isPortAvailable(port))) {
        lastError = new Error(`Port ${port} is already in use`);
        continue;
      }

      const dataDir = path.resolve(
        process.cwd(),
        ".pgdata-test",
        `${process.pid}-${port}`
      );
      const pg = new EmbeddedPostgres({
        databaseDir: dataDir,
        user: EMBEDDED_USER,
        password: EMBEDDED_PASSWORD,
        port,
        persistent: false,
      });

      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
        fs.mkdirSync(dataDir, { recursive: true });

        await pg.initialise();
        await pg.start();
        await pg.createDatabase(EMBEDDED_DB);

        databaseUrl = `postgres://${EMBEDDED_USER}:${EMBEDDED_PASSWORD}@127.0.0.1:${port}/${EMBEDDED_DB}`;
        stopServer = async () => {
          await pg.stop();
        };
        started = true;
        break;
      } catch (error) {
        lastError = error;
        await pg.stop().catch(() => undefined);
        killLeftoverEmbeddedPostgres();
      }
    }

    if (!started) {
      const message =
        lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(
        `Embedded PostgreSQL could not start on any test port (${CANDIDATE_PORTS.join(
          ", "
        )}). Last error: ${message}. ` +
          "If this mentions EACCES/EPERM, move the project out of a OneDrive-synced folder, " +
          "add an antivirus exclusion for backend/.pgdata-test, or set TEST_DATABASE_URL."
      );
    }
  }

  // Workers read this in setup-env.ts, which runs after global setup.
  fs.writeFileSync(
    INFO_PATH,
    JSON.stringify({ databaseUrl }, null, 2),
    "utf8"
  );

  const client = await connectWithRetry(databaseUrl);

  try {
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
    const seeded = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM products"
    );
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
    fs.rmSync(INFO_PATH, { force: true });
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
