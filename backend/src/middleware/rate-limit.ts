import rateLimit from "express-rate-limit";
import { env } from "../config/env";

/**
 * Rate limiting is disabled under NODE_ENV=test so the suite can call the
 * sensitive endpoints repeatedly. Production/development both get real limits.
 */
function limiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => env.isTest,
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    },
  });
}

/** Brute-force protection for login/register. */
export const authRateLimiter = limiter(
  env.authRateLimitWindowMs,
  env.authRateLimitMax
);

/** Coarse limit for cart/order writes. */
export const writeRateLimiter = limiter(
  env.writeRateLimitWindowMs,
  env.writeRateLimitMax
);
