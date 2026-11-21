import { randomBytes } from "node:crypto";
import { z } from "zod";
import { pool } from "../../db/pool";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../lib/errors";
import { effectiveUnitPriceMinor, formatOrderNumber, toMajorUnits } from "../../lib/money";
import { insertOutboxEvent, type OutboxClient } from "../outbox/outbox.service";

const MAX_LINES = 50;

/** Mirrors the frontend DELIVERY_OPTIONS prices, in minor units. */
const DELIVERY_FEES_MINOR: Record<string, number> = {
  standard: 0,
  express: 1500,
};

const addressSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  address: z.string().trim().min(1).max(200),
  apartment: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  pinCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(80),
});

export const placeOrderSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.uuid(),
        quantity: z.coerce.number().int().min(1).max(99),
      })
    )
    .min(1)
    .max(MAX_LINES)
    .optional(),
  shippingAddress: addressSchema,
  contact: z.object({
    email: z.email("Enter a valid email address"),
    phone: z.string().trim().regex(/^[\d\s\-+()]{7,20}$/, "Enter a valid phone number"),
  }),
  deliveryMethod: z.enum(["standard", "express"]).default("standard"),
  paymentMethod: z.enum(["card", "upi", "cod"]).default("cod"),
  notes: z.string().trim().max(500).optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

type OrderItemDto = {
  id: string;
  variantId: string | null;
  productUuid: string | null;
  productId: number | null;
  slug: string | null;
  name: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type OrderRow = {
  id: string;
  order_number: string;
  user_id: string | null;
  status: string;
  subtotal_paise: string;
  discount_paise: string;
  delivery_fee_paise: string;
  total_paise: string;
  currency: string;
  shipping_address: Record<string, unknown>;
  contact_email: string | null;
  contact_phone: string | null;
  delivery_method: string;
  payment_method: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

type OrderItemRow = {
  id: string;
  variant_id: string | null;
  product_uuid: string | null;
  legacy_id: number | null;
  slug: string | null;
  product_name: string;
  sku: string;
  size: string;
  color: string;
  unit_price_paise: string;
  quantity: number;
  line_total_paise: string;
};

function mapOrder(order: OrderRow, items: OrderItemRow[]) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    currency: order.currency,
    subtotal: toMajorUnits(order.subtotal_paise),
    discount: toMajorUnits(order.discount_paise),
    deliveryFee: toMajorUnits(order.delivery_fee_paise),
    total: toMajorUnits(order.total_paise),
    items: items.map<OrderItemDto>((item) => ({
      id: item.id,
      variantId: item.variant_id,
      productUuid: item.product_uuid,
      productId: item.legacy_id,
      slug: item.slug,
      name: item.product_name,
      sku: item.sku,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      unitPrice: toMajorUnits(item.unit_price_paise),
      lineTotal: toMajorUnits(item.line_total_paise),
    })),
    contact: {
      email: order.contact_email,
      phone: order.contact_phone,
    },
    shippingAddress: order.shipping_address,
    deliveryMethod: order.delivery_method,
    paymentMethod: order.payment_method,
    notes: order.notes,
    createdAt: order.created_at.toISOString(),
    updatedAt: order.updated_at.toISOString(),
  };
}

const ORDER_ITEMS_SQL = `
  SELECT oi.id, oi.variant_id, p.id AS product_uuid, p.legacy_id, p.slug,
         oi.product_name, oi.sku, oi.size, oi.color,
         oi.unit_price_paise, oi.quantity, oi.line_total_paise
    FROM order_items oi
    LEFT JOIN product_variants v ON v.id = oi.variant_id
    LEFT JOIN products p ON p.id = v.product_id
   WHERE oi.order_id = $1
   ORDER BY oi.created_at ASC, oi.id ASC`;

async function loadOrder(orderId: string) {
  const orderResult = await pool.query<OrderRow>(
    "SELECT * FROM orders WHERE id = $1",
    [orderId]
  );
  const order = orderResult.rows[0];
  if (!order) return null;

  const items = await pool.query<OrderItemRow>(ORDER_ITEMS_SQL, [orderId]);
  return mapOrder(order, items.rows);
}

export async function findOrderByIdempotencyKey(
  idempotencyKey: string,
  userId: string | null
) {
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM orders WHERE idempotency_key = $1 AND (user_id = $2 OR $2 IS NULL)",
    [idempotencyKey, userId]
  );
  return rows[0] ? loadOrder(rows[0].id) : null;
}

type CartLine = { variantId: string; quantity: number };

async function readCartLines(
  client: import("pg").PoolClient,
  userId: string | null,
  guestToken: string | null
): Promise<{ cartId: string | null; lines: CartLine[] }> {
  const cartResult = userId
    ? await client.query<{ id: string }>(
        "SELECT id FROM carts WHERE user_id = $1 AND status = 'active'",
        [userId]
      )
    : guestToken
      ? await client.query<{ id: string }>(
          "SELECT id FROM carts WHERE guest_token = $1 AND status = 'active'",
          [guestToken]
        )
      : { rows: [] as { id: string }[] };

  const cartId = cartResult.rows[0]?.id ?? null;
  if (!cartId) return { cartId: null, lines: [] };

  const { rows } = await client.query<{ variant_id: string; quantity: number }>(
    "SELECT variant_id, quantity FROM cart_items WHERE cart_id = $1",
    [cartId]
  );

  return {
    cartId,
    lines: rows.map((row) => ({
      variantId: row.variant_id,
      quantity: row.quantity,
    })),
  };
}

type PricedLine = {
  variantId: string;
  productUuid: string;
  legacyId: number;
  quantity: number;
  title: string;
  sku: string;
  size: string;
  color: string;
  unitPriceMinor: number;
  lineTotalMinor: number;
};

/**
 * Creates an order atomically.
 *
 * Everything below happens in one PostgreSQL transaction:
 *   1. lock the inventory rows (SELECT ... FOR UPDATE, ordered to avoid deadlocks)
 *   2. verify stock, price from database values
 *   3. insert order + order items
 *   4. decrement inventory
 *   5. write the outbox events
 * A failure at any point rolls the whole thing back, so neither stock nor an
 * event can leak out of a rejected order.
 */
export async function placeOrder(params: {
  userId: string | null;
  guestToken: string | null;
  input: PlaceOrderInput;
  idempotencyKey: string;
}) {
  const { userId, guestToken, input, idempotencyKey } = params;

  // Fast path: the same key already produced an order, so return it untouched
  // instead of trying to re-checkout an already completed cart.
  const existing = await findOrderByIdempotencyKey(idempotencyKey, userId);
  if (existing) {
    return { order: existing, replayed: true };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cart = await readCartLines(client, userId, guestToken);
    const lines = input.items
      ? input.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        }))
      : cart.lines;

    if (lines.length === 0) {
      throw new BadRequestError(
        "Your cart is empty",
        "EMPTY_CART"
      );
    }

    // Merge duplicates and sort by variant id so concurrent orders always lock
    // rows in the same order (avoids deadlocks).
    const merged = new Map<string, number>();
    for (const line of lines) {
      merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
    }
    const sortedLines = [...merged.entries()]
      .map(([variantId, quantity]) => ({ variantId, quantity }))
      .sort((a, b) => a.variantId.localeCompare(b.variantId));

    const variantIds = sortedLines.map((line) => line.variantId);

    const { rows: variantRows } = await client.query<{
      variant_id: string;
      product_id: string;
      legacy_id: number;
      title: string;
      sku: string;
      size: string;
      color: string;
      price_paise: string;
      discount_percentage: string;
      discount_amount_paise: string;
    }>(
      `SELECT v.id AS variant_id, p.id AS product_id, p.legacy_id, p.title, v.sku,
              v.size, v.color, v.price_paise, p.discount_percentage, p.discount_amount_paise
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
        WHERE v.id = ANY($1::uuid[]) AND v.is_active = true`,
      [variantIds]
    );

    const variantById = new Map(variantRows.map((row) => [row.variant_id, row]));
    const missing = variantIds.filter((id) => !variantById.has(id));
    if (missing.length > 0) {
      throw new BadRequestError(
        "Some items are no longer available",
        "VARIANT_NOT_FOUND",
        { variantIds: missing }
      );
    }

    // Lock every inventory row involved, in the same deterministic order.
    const { rows: stockRows } = await client.query<{
      variant_id: string;
      quantity: number;
    }>(
      `SELECT variant_id, quantity FROM inventory
        WHERE variant_id = ANY($1::uuid[])
        ORDER BY variant_id
        FOR UPDATE`,
      [variantIds]
    );
    const stockByVariant = new Map(
      stockRows.map((row) => [row.variant_id, row.quantity])
    );

    const insufficient: {
      variantId: string;
      requested: number;
      available: number;
    }[] = [];

    const priced: PricedLine[] = sortedLines.map((line) => {
      const variant = variantById.get(line.variantId)!;
      const available = stockByVariant.get(line.variantId) ?? 0;

      if (available < line.quantity) {
        insufficient.push({
          variantId: line.variantId,
          requested: line.quantity,
          available,
        });
      }

      const unitPriceMinor = effectiveUnitPriceMinor({
        pricePaise: variant.price_paise,
        discountPercentage: variant.discount_percentage,
        discountAmountPaise: variant.discount_amount_paise,
      });

      return {
        variantId: line.variantId,
        productUuid: variant.product_id,
        legacyId: variant.legacy_id,
        quantity: line.quantity,
        title: variant.title,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        unitPriceMinor,
        lineTotalMinor: unitPriceMinor * line.quantity,
      };
    });

    if (insufficient.length > 0) {
      throw new ConflictError(
        "Insufficient stock for one or more items",
        "INSUFFICIENT_STOCK",
        { items: insufficient }
      );
    }

    const subtotalMinor = priced.reduce((sum, line) => sum + line.lineTotalMinor, 0);
    const deliveryFeeMinor = DELIVERY_FEES_MINOR[input.deliveryMethod] ?? 0;
    const discountMinor = 0; // promo codes are not server-authoritative yet
    const totalMinor = Math.max(
      0,
      subtotalMinor - discountMinor + deliveryFeeMinor
    );

    const orderNumber = formatOrderNumber(
      new Date(),
      randomBytes(3).toString("hex").toUpperCase()
    );

    const { rows: orderRows } = await client.query<OrderRow>(
      `INSERT INTO orders (
         order_number, user_id, status, subtotal_paise, discount_paise,
         delivery_fee_paise, total_paise, currency, shipping_address,
         idempotency_key, notes, contact_email, contact_phone,
         delivery_method, payment_method, cart_id
       ) VALUES ($1, $2, 'confirmed', $3, $4, $5, $6, 'USD', $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        orderNumber,
        userId,
        subtotalMinor,
        discountMinor,
        deliveryFeeMinor,
        totalMinor,
        JSON.stringify(input.shippingAddress),
        idempotencyKey,
        input.notes ?? null,
        input.contact.email.trim().toLowerCase(),
        input.contact.phone.trim(),
        input.deliveryMethod,
        input.paymentMethod,
        cart.cartId,
      ]
    );
    const order = orderRows[0];

    for (const line of priced) {
      await client.query(
        `INSERT INTO order_items (
           order_id, variant_id, product_name, sku, size, color,
           unit_price_paise, quantity, line_total_paise
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          order.id,
          line.variantId,
          line.title,
          line.sku,
          line.size,
          line.color,
          line.unitPriceMinor,
          line.quantity,
          line.lineTotalMinor,
        ]
      );
    }

    for (const line of priced) {
      const updated = await client.query<{ quantity: number }>(
        `UPDATE inventory
            SET quantity = quantity - $1
          WHERE variant_id = $2 AND quantity >= $1
          RETURNING quantity`,
        [line.quantity, line.variantId]
      );
      if (updated.rows.length === 0) {
        // Should be impossible after the FOR UPDATE check; abort rather than
        // ever selling more than we have.
        throw new ConflictError(
          "Insufficient stock for one or more items",
          "INSUFFICIENT_STOCK",
          { items: [{ variantId: line.variantId, requested: line.quantity }] }
        );
      }
    }

    const outbox = client as unknown as OutboxClient;

    await insertOutboxEvent(outbox, {
      type: "order.placed",
      aggregateType: "order",
      aggregateId: order.id,
      payload: {
        event_id: null, // filled in by insertOutboxEvent with the outbox row id
        event_type: "order.placed",
        event_version: 1,
        occurred_at: order.created_at.toISOString(),
        order: {
          id: order.id,
          order_number: order.order_number,
          user_id: order.user_id,
          status: order.status,
          currency: order.currency,
          subtotal: toMajorUnits(order.subtotal_paise),
          discount: toMajorUnits(order.discount_paise),
          delivery_fee: toMajorUnits(order.delivery_fee_paise),
          total: toMajorUnits(order.total_paise),
        },
        items: priced.map((line) => ({
          product_id: line.legacyId,
          product_uuid: line.productUuid,
          variant_id: line.variantId,
          sku: line.sku,
          title: line.title,
          size: line.size,
          color: line.color,
          quantity: line.quantity,
          unit_price: toMajorUnits(line.unitPriceMinor),
          line_total: toMajorUnits(line.lineTotalMinor),
        })),
        inventory: priced.map((line) => ({
          variant_id: line.variantId,
          sku: line.sku,
          quantity_change: -line.quantity,
        })),
      },
    });

    for (const line of priced) {
      await insertOutboxEvent(outbox, {
        type: "inventory.updated",
        aggregateType: "product_variant",
        aggregateId: line.variantId,
        payload: {
          event_id: null,
          event_type: "inventory.updated",
          event_version: 1,
          occurred_at: order.created_at.toISOString(),
          order_id: order.id,
          variant_id: line.variantId,
          product_id: line.legacyId,
          sku: line.sku,
          quantity_change: -line.quantity,
        },
      });
    }

    if (cart.cartId) {
      await client.query(
        "UPDATE carts SET status = 'checked_out' WHERE id = $1",
        [cart.cartId]
      );
    }

    await client.query("COMMIT");

    const created = await loadOrder(order.id);
    return { order: created!, replayed: false };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if ((error as { code?: string }).code === "23505") {
      const replay = await findOrderByIdempotencyKey(idempotencyKey, userId);
      if (replay) {
        return { order: replay, replayed: true };
      }
      throw new ConflictError(
        "That request conflicts with an existing order",
        "DUPLICATE_ORDER"
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function listOrders(
  userId: string,
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit;

  const count = await pool.query<{ total: string }>(
    "SELECT COUNT(*)::text AS total FROM orders WHERE user_id = $1",
    [userId]
  );

  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM orders WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const orders = [];
  for (const row of rows) {
    const order = await loadOrder(row.id);
    if (order) orders.push(order);
  }

  return { orders, total: Number(count.rows[0]?.total ?? 0) };
}

export async function getOrderForUser(orderId: string, userId: string) {
  const { rows } = await pool.query<{ user_id: string | null }>(
    "SELECT user_id FROM orders WHERE id = $1",
    [orderId]
  );
  const row = rows[0];
  if (!row || row.user_id !== userId) {
    throw new NotFoundError("Order not found", "ORDER_NOT_FOUND");
  }

  const order = await loadOrder(orderId);
  if (!order) throw new NotFoundError("Order not found", "ORDER_NOT_FOUND");
  return order;
}
