import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "../../db/pool";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors";
import { effectiveUnitPriceMinor, toMajorUnits } from "../../lib/money";

const MAX_QUANTITY = 99;

type CartRow = { id: string; user_id: string | null; guest_token: string | null };

type CartItemRow = {
  item_id: string;
  quantity: number;
  unit_price_paise: string;
  variant_id: string;
  product_uuid: string;
  legacy_id: number;
  title: string;
  slug: string;
  image_url: string;
  price_paise: string;
  discount_percentage: string;
  discount_amount_paise: string;
  size: string;
  color: string;
  sku: string;
  stock: number;
};

const CART_ITEM_SELECT = `
  SELECT ci.id AS item_id, ci.quantity, ci.unit_price_paise,
         v.id AS variant_id, p.id AS product_uuid, p.legacy_id, p.title, p.slug, p.image_url,
         v.price_paise, p.discount_percentage, p.discount_amount_paise,
         v.size, v.color, v.sku,
         COALESCE(inv.quantity, 0) AS stock
    FROM cart_items ci
    JOIN product_variants v ON v.id = ci.variant_id
    JOIN products p ON p.id = v.product_id
    LEFT JOIN inventory inv ON inv.variant_id = v.id
   WHERE ci.cart_id = $1
   ORDER BY ci.created_at ASC`;

function mapCartItem(row: CartItemRow) {
  const unitPriceMinor = effectiveUnitPriceMinor({
    pricePaise: row.price_paise,
    discountPercentage: row.discount_percentage,
    discountAmountPaise: row.discount_amount_paise,
  });

  return {
    id: row.item_id,
    productId: row.legacy_id,
    variantId: row.variant_id,
    name: row.title,
    slug: row.slug,
    srcUrl: row.image_url,
    price: toMajorUnits(row.price_paise),
    discount: {
      amount: toMajorUnits(row.discount_amount_paise),
      percentage: Number(row.discount_percentage),
    },
    quantity: row.quantity,
    attributes: [row.size, row.color],
    size: row.size,
    color: row.color,
    sku: row.sku,
    stock: row.stock,
    unitPrice: toMajorUnits(unitPriceMinor),
    lineTotal: toMajorUnits(unitPriceMinor * row.quantity),
  };
}

async function loadCartItems(cartId: string) {
  const { rows } = await pool.query<CartItemRow>(CART_ITEM_SELECT, [cartId]);
  return rows.map(mapCartItem);
}

function buildCartPayload(cartId: string | null, items: ReturnType<typeof mapCartItem>[]) {
  const subtotalMinor = items.reduce(
    (sum, item) => sum + Math.round(item.lineTotal * 100),
    0
  );
  const listTotalMinor = items.reduce(
    (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
    0
  );

  return {
    cartId,
    currency: "USD",
    items,
    totals: {
      subtotal: toMajorUnits(subtotalMinor),
      discount: toMajorUnits(Math.max(0, listTotalMinor - subtotalMinor)),
      total: toMajorUnits(subtotalMinor),
      itemCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    },
  };
}

/**
 * Finds (or creates) the active cart for the caller.
 *
 * Authenticated users get one active cart per user (enforced by a partial
 * unique index). Guests get a cart keyed by an opaque cookie token.
 * `newGuestToken` is returned when the caller must set the cookie.
 */
export async function resolveCart(
  userId: string | null,
  guestToken: string | null
): Promise<{ cart: CartRow; newGuestToken: string | null }> {
  if (userId) {
    const existing = await pool.query<CartRow>(
      "SELECT id, user_id, guest_token FROM carts WHERE user_id = $1 AND status = 'active'",
      [userId]
    );
    if (existing.rows[0]) {
      return { cart: existing.rows[0], newGuestToken: null };
    }

    const inserted = await pool.query<CartRow>(
      `INSERT INTO carts (user_id) VALUES ($1)
       ON CONFLICT DO NOTHING
       RETURNING id, user_id, guest_token`,
      [userId]
    );
    if (inserted.rows[0]) {
      return { cart: inserted.rows[0], newGuestToken: null };
    }

    const raced = await pool.query<CartRow>(
      "SELECT id, user_id, guest_token FROM carts WHERE user_id = $1 AND status = 'active'",
      [userId]
    );
    return { cart: raced.rows[0], newGuestToken: null };
  }

  if (guestToken) {
    const existing = await pool.query<CartRow>(
      "SELECT id, user_id, guest_token FROM carts WHERE guest_token = $1 AND status = 'active'",
      [guestToken]
    );
    if (existing.rows[0]) {
      return { cart: existing.rows[0], newGuestToken: null };
    }
  }

  const token = randomUUID();
  const inserted = await pool.query<CartRow>(
    `INSERT INTO carts (guest_token) VALUES ($1)
     RETURNING id, user_id, guest_token`,
    [token]
  );
  return { cart: inserted.rows[0], newGuestToken: token };
}

export async function getCart(
  userId: string | null,
  guestToken: string | null
) {
  const resolved = await resolveCart(userId, guestToken);
  const items = await loadCartItems(resolved.cart.id);
  return {
    cart: buildCartPayload(resolved.cart.id, items),
    newGuestToken: resolved.newGuestToken,
  };
}

export const addCartItemSchema = z
  .object({
    variantId: z.uuid().optional(),
    productId: z.coerce.number().int().positive().optional(),
    size: z.string().trim().min(1).max(40).optional(),
    color: z.string().trim().min(1).max(40).optional(),
    quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY).default(1),
  })
  .refine((value) => Boolean(value.variantId ?? value.productId), {
    message: "Provide variantId or productId",
  });

export async function resolveVariantId(input: {
  variantId?: string;
  productId?: number;
  size?: string;
  color?: string;
}): Promise<string> {
  if (input.variantId) {
    const { rows } = await pool.query<{ id: string }>(
      "SELECT id FROM product_variants WHERE id = $1 AND is_active = true",
      [input.variantId]
    );
    if (!rows[0]) throw new NotFoundError("Product variant not found", "VARIANT_NOT_FOUND");
    return rows[0].id;
  }

  const conditions = ["p.legacy_id = $1", "v.is_active = true"];
  const values: unknown[] = [input.productId];
  if (input.size) {
    values.push(input.size);
    conditions.push(`v.size = $${values.length}`);
  }
  if (input.color) {
    values.push(input.color);
    conditions.push(`v.color = $${values.length}`);
  }

  const { rows } = await pool.query<{ id: string }>(
    `SELECT v.id FROM product_variants v
       JOIN products p ON p.id = v.product_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY v.size, v.color`,
    values
  );

  if (rows.length === 0) {
    throw new NotFoundError(
      "No matching variant for this product/size/color",
      "VARIANT_NOT_FOUND"
    );
  }
  if (rows.length > 1) {
    throw new BadRequestError(
      "This product has multiple variants; provide size and color or variantId",
      "VARIANT_AMBIGUOUS"
    );
  }
  return rows[0].id;
}

export async function addItem(
  userId: string | null,
  guestToken: string | null,
  input: z.infer<typeof addCartItemSchema>
) {
  const resolved = await resolveCart(userId, guestToken);
  const variantId = await resolveVariantId(input);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const priceResult = await client.query<{ price_paise: string }>(
      "SELECT price_paise FROM product_variants WHERE id = $1 AND is_active = true",
      [variantId]
    );
    if (!priceResult.rows[0]) {
      throw new NotFoundError("Product variant not found", "VARIANT_NOT_FOUND");
    }

    // Lock the inventory row so a checkout cannot consume stock between the
    // availability check and the insert.
    const stockResult = await client.query<{ quantity: number }>(
      "SELECT quantity FROM inventory WHERE variant_id = $1 FOR UPDATE",
      [variantId]
    );
    const variant = {
      quantity: stockResult.rows[0]?.quantity ?? 0,
      price_paise: priceResult.rows[0].price_paise,
    };

    const existing = await client.query<{ id: string; quantity: number }>(
      "SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND variant_id = $2 FOR UPDATE",
      [resolved.cart.id, variantId]
    );

    const currentQuantity = existing.rows[0]?.quantity ?? 0;
    const nextQuantity = currentQuantity + input.quantity;

    if (nextQuantity > variant.quantity) {
      throw new ConflictError(
        variant.quantity === 0
          ? "This item is out of stock"
          : `Only ${variant.quantity} unit(s) available`,
        "INSUFFICIENT_STOCK",
        { variantId, available: variant.quantity, requested: nextQuantity }
      );
    }

    if (existing.rows[0]) {
      await client.query("UPDATE cart_items SET quantity = $1 WHERE id = $2", [
        nextQuantity,
        existing.rows[0].id,
      ]);
    } else {
      await client.query(
        `INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price_paise)
         VALUES ($1, $2, $3, $4)`,
        [resolved.cart.id, variantId, nextQuantity, variant.price_paise]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const items = await loadCartItems(resolved.cart.id);
  return {
    cart: buildCartPayload(resolved.cart.id, items),
    newGuestToken: resolved.newGuestToken,
  };
}

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY),
});

async function assertItemOwnership(
  cartId: string,
  itemId: string
): Promise<{ variantId: string }> {
  const { rows } = await pool.query<{ variant_id: string }>(
    "SELECT variant_id FROM cart_items WHERE id = $1 AND cart_id = $2",
    [itemId, cartId]
  );
  if (!rows[0]) {
    throw new NotFoundError("Cart item not found", "CART_ITEM_NOT_FOUND");
  }
  return { variantId: rows[0].variant_id };
}

export async function updateItem(
  userId: string | null,
  guestToken: string | null,
  itemId: string,
  quantity: number
) {
  const resolved = await resolveCart(userId, guestToken);
  const item = await assertItemOwnership(resolved.cart.id, itemId);

  const stock = await pool.query<{ quantity: number }>(
    "SELECT COALESCE(quantity, 0) AS quantity FROM inventory WHERE variant_id = $1",
    [item.variantId]
  );
  const available = stock.rows[0]?.quantity ?? 0;

  if (quantity > available) {
    throw new ConflictError(
      available === 0
        ? "This item is out of stock"
        : `Only ${available} unit(s) available`,
      "INSUFFICIENT_STOCK",
      { variantId: item.variantId, available, requested: quantity }
    );
  }

  await pool.query("UPDATE cart_items SET quantity = $1 WHERE id = $2", [
    quantity,
    itemId,
  ]);

  const items = await loadCartItems(resolved.cart.id);
  return {
    cart: buildCartPayload(resolved.cart.id, items),
    newGuestToken: resolved.newGuestToken,
  };
}

export async function removeItem(
  userId: string | null,
  guestToken: string | null,
  itemId: string
) {
  const resolved = await resolveCart(userId, guestToken);
  await assertItemOwnership(resolved.cart.id, itemId);

  await pool.query("DELETE FROM cart_items WHERE id = $1", [itemId]);

  const items = await loadCartItems(resolved.cart.id);
  return {
    cart: buildCartPayload(resolved.cart.id, items),
    newGuestToken: resolved.newGuestToken,
  };
}

export { MAX_QUANTITY, CART_ITEM_SELECT, loadCartItems, buildCartPayload };
