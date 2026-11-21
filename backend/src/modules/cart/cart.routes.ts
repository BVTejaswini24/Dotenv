import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { asyncHandler, parseInput } from "../../lib/http";
import { optionalAuth } from "../../middleware/auth";
import { writeRateLimiter } from "../../middleware/rate-limit";
import {
  addCartItemSchema,
  addItem,
  getCart,
  removeItem,
  updateCartItemSchema,
  updateItem,
} from "./cart.service";

const router = Router();

router.use("/cart", optionalAuth);

const guestTokenSchema = z.uuid();

function guestTokenFrom(req: Request): string | null {
  const token = (req.cookies as Record<string, string> | undefined)?.[env.cartCookieName];
  return token && guestTokenSchema.safeParse(token).success ? token : null;
}

/** Sets the guest cart cookie when a new guest cart was created. */
function applyGuestCookie(res: Response, token: string | null): void {
  if (!token) return;
  res.cookie(env.cartCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function itemIdParam(req: Request): string {
  return parseInput(
    z.object({ itemId: z.uuid("Cart item id must be a UUID") }),
    req.params
  ).itemId;
}

function respond(
  res: Response,
  result: { cart: unknown; newGuestToken: string | null },
  status = 200
): void {
  applyGuestCookie(res, result.newGuestToken);
  res.status(status).json({ data: result.cart });
}

/** GET /api/cart */
router.get(
  "/cart",
  asyncHandler(async (req, res) => {
    const result = await getCart(req.user?.id ?? null, guestTokenFrom(req));
    respond(res, result);
  })
);

/** POST /api/cart/items */
router.post(
  "/cart/items",
  writeRateLimiter,
  asyncHandler(async (req, res) => {
    const input = parseInput(addCartItemSchema, req.body);
    const result = await addItem(req.user?.id ?? null, guestTokenFrom(req), input);
    respond(res, result, 201);
  })
);

/** PATCH /api/cart/items/:itemId */
router.patch(
  "/cart/items/:itemId",
  writeRateLimiter,
  asyncHandler(async (req, res) => {
    const itemId = itemIdParam(req);
    const { quantity } = parseInput(updateCartItemSchema, req.body);
    const result = await updateItem(
      req.user?.id ?? null,
      guestTokenFrom(req),
      itemId,
      quantity
    );
    respond(res, result);
  })
);

/** DELETE /api/cart/items/:itemId */
router.delete(
  "/cart/items/:itemId",
  writeRateLimiter,
  asyncHandler(async (req, res) => {
    const itemId = itemIdParam(req);
    const result = await removeItem(
      req.user?.id ?? null,
      guestTokenFrom(req),
      itemId
    );
    respond(res, result);
  })
);

export default router;
