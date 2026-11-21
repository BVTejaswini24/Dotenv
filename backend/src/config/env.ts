import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

const port = Number(process.env.PORT?.trim() || 4000);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long");
}

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === "test",
  port,
  databaseUrl: required("DATABASE_URL"),
  databaseSsl: (process.env.DATABASE_SSL ?? "false").toLowerCase() === "true",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",

  // Sessions live in an HTTP-only cookie; the raw JWT is never returned in JSON.
  jwtSecret,
  sessionTtlDays: optionalInt("SESSION_TTL_DAYS", 7),
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "shopsphere_session",
  cartCookieName: process.env.CART_COOKIE_NAME ?? "shopsphere_cart",
  // Secure cookies require HTTPS, so they are opt-out only for local dev.
  cookieSecure:
    (process.env.COOKIE_SECURE ?? String(isProduction)).toLowerCase() === "true",

  authRateLimitWindowMs: optionalInt("AUTH_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  authRateLimitMax: optionalInt("AUTH_RATE_LIMIT_MAX", 30),
  writeRateLimitWindowMs: optionalInt("WRITE_RATE_LIMIT_WINDOW_MS", 60 * 1000),
  writeRateLimitMax: optionalInt("WRITE_RATE_LIMIT_MAX", 120),
} as const;
