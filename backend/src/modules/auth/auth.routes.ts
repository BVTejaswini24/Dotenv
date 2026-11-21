import { Router } from "express";
import { env } from "../../config/env";
import { asyncHandler, parseInput } from "../../lib/http";
import { UnauthorizedError } from "../../lib/errors";
import { requireAuth, sessionCookieOptions, signSessionToken } from "../../middleware/auth";
import { authRateLimiter } from "../../middleware/rate-limit";
import {
  authenticateUser,
  getUserById,
  loginSchema,
  registerSchema,
  registerUser,
  toUserDto,
} from "./auth.service";

const router = Router();

/** POST /api/auth/register */
router.post(
  "/auth/register",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const input = parseInput(registerSchema, req.body);
    const user = await registerUser(input);

    res.cookie(
      env.sessionCookieName,
      signSessionToken({ id: user.id, email: user.email, role: "customer" }),
      sessionCookieOptions()
    );

    res.status(201).json({ data: { user } });
  })
);

/** POST /api/auth/login */
router.post(
  "/auth/login",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const input = parseInput(loginSchema, req.body);
    const user = await authenticateUser(input);

    res.cookie(
      env.sessionCookieName,
      signSessionToken({ id: user.id, email: user.email, role: "customer" }),
      sessionCookieOptions()
    );

    res.status(200).json({ data: { user } });
  })
);

/** POST /api/auth/logout — clears the HTTP-only session cookie. */
router.post("/auth/logout", (req, res) => {
  res.clearCookie(env.sessionCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    path: "/",
  });
  res.status(204).send();
});

/** GET /api/auth/me — the server, not the client, decides who is signed in. */
router.get(
  "/auth/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.user!.id);
    if (!user) throw new UnauthorizedError("Session is no longer valid");
    res.status(200).json({ data: { user } });
  })
);

export default router;
