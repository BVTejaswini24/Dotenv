import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { asyncHandler, paginationMeta, parseInput, resolvePagination } from "../../lib/http";
import { BadRequestError } from "../../lib/errors";
import { optionalAuth, requireAuth } from "../../middleware/auth";
import { writeRateLimiter } from "../../middleware/rate-limit";
import {
  getOrderForUser,
  listOrders,
  placeOrder,
  placeOrderSchema,
} from "./orders.service";

const router = Router();

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency-Key must be at least 8 characters")
  .max(200);

function readGuestToken(req: import("express").Request): string | null {
  const token = (req.cookies as Record<string, string> | undefined)?.[env.cartCookieName];
  if (!token) return null;
  return z.uuid().safeParse(token).success ? token : null;
}

/**
 * POST /api/orders
 *
 * Requires an `Idempotency-Key` header. Re-sending the same key returns the
 * original order with 200 instead of charging/ordering twice.
 */
router.post(
  "/orders",
  writeRateLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const headerKey = req.header("Idempotency-Key");
    if (!headerKey) {
      throw new BadRequestError(
        "Idempotency-Key header is required",
        "IDEMPOTENCY_KEY_REQUIRED"
      );
    }
    const idempotencyKey = parseInput(
      idempotencyKeySchema,
      headerKey,
      "INVALID_IDEMPOTENCY_KEY"
    );
    const input = parseInput(placeOrderSchema, req.body);

    const result = await placeOrder({
      userId: req.user?.id ?? null,
      guestToken: readGuestToken(req),
      input,
      idempotencyKey,
    });

    res.status(result.replayed ? 200 : 201).json({
      data: result.order,
      meta: { idempotentReplay: result.replayed },
    });
  })
);

/** GET /api/orders — the signed-in user's order history. */
router.get(
  "/orders",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page, limit } = parseInput(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      }),
      req.query
    );
    const pagination = resolvePagination(page, limit, 50);
    const { orders, total } = await listOrders(req.user!.id, pagination.page, pagination.limit);

    res.status(200).json({
      data: orders,
      pagination: paginationMeta(total, pagination),
    });
  })
);

/** GET /api/orders/:id — a single order, only if it belongs to the caller. */
router.get(
  "/orders/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = parseInput(
      z.object({ id: z.uuid("Order id must be a UUID") }),
      req.params
    );
    const order = await getOrderForUser(id, req.user!.id);
    res.status(200).json({ data: order });
  })
);

export default router;
