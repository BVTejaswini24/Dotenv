/**
 * Runs before any test module is imported, so src/config/env.ts sees a valid
 * configuration on first import.
 */
process.env.NODE_ENV = "test";
process.env.PORT = "4000";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://shopsphere:shopsphere@127.0.0.1:55432/shopsphere_test";
process.env.DATABASE_SSL = "false";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? "test-only-jwt-secret-with-at-least-32-characters";
process.env.CORS_ORIGIN = "http://localhost:3000";
