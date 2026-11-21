import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { pool } from "../db/pool";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

export type AuthUser = {
  id: string;
  email: string;
  role: "customer" | "admin";
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

type TokenPayload = {
  sub: string;
  email: string;
  role: "customer" | "admin";
};

export function signSessionToken(user: AuthUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: `${env.sessionTtlDays}d`,
    issuer: "shopsphere-backend",
  });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.cookieSecure,
    path: "/",
    maxAge: env.sessionTtlDays * 24 * 60 * 60 * 1000,
  };
}

function readToken(req: Request): string | null {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[
    env.sessionCookieName
  ];
  if (cookieToken) return cookieToken;

  // Bearer tokens are accepted for API clients/tests. Browsers keep using the
  // HTTP-only cookie, so the JWT never has to be stored in localStorage.
  const header = req.headers.authorization;
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return null;
}

async function loadUser(req: Request): Promise<AuthUser | null> {
  const token = readToken(req);
  if (!token) return null;

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret, {
      issuer: "shopsphere-backend",
    }) as TokenPayload;
  } catch {
    return null;
  }

  const { rows } = await pool.query<AuthUser>(
    "SELECT id, email, role FROM users WHERE id = $1",
    [payload.sub]
  );
  if (rows.length === 0) return null;

  const user = rows[0];
  return { id: user.id, email: user.email, role: user.role };
}

/** Attaches req.user when a valid session exists; never rejects. */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await loadUser(req);
    if (user) req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/** Rejects the request with 401 unless a valid session exists. */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await loadUser(req);
    if (!user) {
      throw new UnauthorizedError("You must be signed in to do that");
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }
  if (req.user.role !== "admin") {
    next(new ForbiddenError("Administrator access required"));
    return;
  }
  next();
}
