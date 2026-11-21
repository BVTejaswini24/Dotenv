import fs from "node:fs";
import path from "node:path";

/**
 * Runs before any test module is imported, so src/config/env.ts sees a valid
 * configuration on first import.
 */
process.env.NODE_ENV = "test";
process.env.PORT = "4000";
process.env.DATABASE_SSL = "false";

// global-setup.ts picks a free port and writes the actual URL here; fall back
// to the original fixed port when the file is missing.
const infoPath = path.resolve(process.cwd(), "tests", ".test-database.json");
let databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  try {
    const info = JSON.parse(fs.readFileSync(infoPath, "utf8")) as {
      databaseUrl?: unknown;
    };
    if (typeof info.databaseUrl === "string") databaseUrl = info.databaseUrl;
  } catch {
    // use the default below
  }
}

process.env.DATABASE_URL =
  databaseUrl ??
  "postgres://shopsphere:shopsphere@127.0.0.1:55432/shopsphere_test";

process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? "test-only-jwt-secret-with-at-least-32-characters";
process.env.CORS_ORIGIN = "http://localhost:3000";

// The suite must never call (and pay for) a live provider. Empty values win
// over backend/.env because dotenv does not override existing variables.
process.env.FASHN_API_KEY = "";
process.env.REPLICATE_API_TOKEN = "";
process.env.HF_TOKEN = "";
