import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";
import { seedCatalog } from "../src/db/seed";
import catalog from "../src/data/catalog.json";

const app = createApp();
const EXPECTED_PRODUCTS = (catalog.products as unknown[]).length;

const PASSWORD = "Sup3rSecret!";
let userCounter = 0;

function uniqueEmail(prefix = "user") {
  userCounter += 1;
  return `${prefix}-${Date.now()}-${userCounter}@example.com`;
}

type Agent = ReturnType<typeof request.agent>;

async function registerUser(prefix = "user") {
  const agent = request.agent(app);
  const email = uniqueEmail(prefix);
  const res = await agent.post("/api/auth/register").send({
    firstName: "Test",
    lastName: "Shopper",
    email,
    password: PASSWORD,
  });
  expect(res.status).toBe(201);
  return { agent, user: res.body.data.user as { id: string; email: string }, email };
}

async function addToCart(
  agent: Agent,
  variantId: string,
  quantity = 1
) {
  return agent.post("/api/cart/items").send({ variantId, quantity });
}

async function firstVariantOf(productId: number) {
  const res = await request(app).get(`/api/products/${productId}`);
  expect(res.status).toBe(200);
  const variant = res.body.data.variants[0];
  expect(variant).toBeTruthy();
  return variant as { id: string; size: string; color: string; stock: number };
}

function orderPayload(overrides: Record<string, unknown> = {}) {
  return {
    shippingAddress: {
      firstName: "Test",
      lastName: "Shopper",
      address: "1 Test Street",
      apartment: "",
      city: "Hyderabad",
      state: "Telangana",
      pinCode: "500001",
      country: "India",
    },
    contact: { email: uniqueEmail("order"), phone: "+91 9000000000" },
    deliveryMethod: "standard",
    paymentMethod: "cod",
    ...overrides,
  };
}

const ALL_TABLES = [
  "order_items",
  "orders",
  "cart_items",
  "carts",
  "outbox_events",
  "processed_events",
  "reviews",
  "users",
].join(", ");

beforeEach(async () => {
  await pool.query(`TRUNCATE TABLE ${ALL_TABLES} RESTART IDENTITY CASCADE`);
  await pool.query("UPDATE inventory SET quantity = 50");
});

afterAll(async () => {
  await pool.end();
});

describe("health and database connection", () => {
  it("reports the database as connected", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("connected");
  });

  it("has the full seeded catalogue", async () => {
    const { rows } = await pool.query<{ products: string; variants: string }>(
      `SELECT (SELECT COUNT(*) FROM products)::text AS products,
              (SELECT COUNT(*) FROM product_variants)::text AS variants`
    );
    expect(Number(rows[0].products)).toBe(EXPECTED_PRODUCTS);
    expect(Number(rows[0].variants)).toBeGreaterThan(38);
  });

  it("is idempotent when the seed runs again", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seedCatalog(client);
      const counts = await client.query<{ products: string; variants: string }>(
        `SELECT (SELECT COUNT(*) FROM products)::text AS products,
                (SELECT COUNT(*) FROM product_variants)::text AS variants`
      );
      expect(Number(counts.rows[0].products)).toBe(EXPECTED_PRODUCTS);
      const before = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM product_variants"
      );
      expect(Number(before.rows[0].count)).toBe(Number(counts.rows[0].variants));
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe("products", () => {
  it("lists a paginated page of products", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(12);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 12,
      total: EXPECTED_PRODUCTS,
      totalPages: Math.ceil(EXPECTED_PRODUCTS / 12),
      hasNextPage: true,
      hasPrevPage: false,
    });

    const product = res.body.data[0];
    expect(typeof product.id).toBe("number");
    expect(product).toHaveProperty("srcUrl");
    expect(product).toHaveProperty("discount.percentage");
    expect(Array.isArray(product.sizes)).toBe(true);
    expect(Array.isArray(product.variants)).toBe(true);
  });

  it("paginates without repeating products", async () => {
    const page1 = await request(app).get("/api/products?page=1&limit=5");
    const page2 = await request(app).get("/api/products?page=2&limit=5");
    const ids1 = page1.body.data.map((p: { id: number }) => p.id);
    const ids2 = page2.body.data.map((p: { id: number }) => p.id);
    expect(ids1).toHaveLength(5);
    expect(ids2).toHaveLength(5);
    expect(ids1.filter((id: number) => ids2.includes(id))).toHaveLength(0);
  });

  it("filters by category", async () => {
    const res = await request(app).get("/api/products?category=jeans&limit=100");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const product of res.body.data) {
      expect(product.category).toBe("jeans");
    }
  });

  it("filters by price range", async () => {
    const res = await request(app).get(
      "/api/products?minPrice=100&maxPrice=200&limit=100"
    );
    expect(res.status).toBe(200);
    for (const product of res.body.data) {
      expect(product.price).toBeGreaterThanOrEqual(100);
      expect(product.price).toBeLessThanOrEqual(200);
    }
  });

  it("sorts by price ascending", async () => {
    const res = await request(app).get("/api/products?sort=price_asc&limit=100");
    const prices = res.body.data.map((p: { price: number }) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("rejects an invalid limit", async () => {
    const res = await request(app).get("/api/products?limit=500");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns a single product by legacy id and by slug", async () => {
    const byId = await request(app).get("/api/products/1");
    expect(byId.status).toBe(200);
    expect(byId.body.data.id).toBe(1);

    const bySlug = await request(app).get("/api/products/skinny-fit-jeans");
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.data.slug).toBe("skinny-fit-jeans");
  });

  it("returns 404 for an unknown product", async () => {
    const res = await request(app).get("/api/products/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });
});

describe("categories", () => {
  it("lists all categories with product counts", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(8);
    expect(res.body.data[0]).toMatchObject({ id: 1, slug: "t-shirts" });
    const total = res.body.data.reduce(
      (sum: number, category: { productCount: number }) => sum + category.productCount,
      0
    );
    expect(total).toBe(EXPECTED_PRODUCTS);
  });
});

describe("virtual try-on", () => {
  it("lists eligible products for try-on", async () => {
    const res = await request(app).get("/api/tryon/products");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.products)).toBe(true);
    expect(res.body.data.products.length).toBeGreaterThan(0);
    const sample = res.body.data.products[0];
    expect(sample).toHaveProperty("id");
    expect(sample).toHaveProperty("tryOnCategory");
    expect(sample).toHaveProperty("tryOnType");
  });

  it("validates try-on request payload", async () => {
    const res = await request(app).post("/api/tryon").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("authentication", () => {
  it("registers a user, sets an HTTP-only cookie and hides the hash", async () => {
    const agent = request.agent(app);
    const email = uniqueEmail("new");
    const res = await agent.post("/api/auth/register").send({
      firstName: "Ada",
      lastName: "Lovelace",
      email,
      password: PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email, firstName: "Ada" });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    expect(JSON.stringify(res.body)).not.toContain("password_hash");

    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain("shopsphere_session=");
    expect(cookie).toContain("HttpOnly");

    const { rows } = await pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE email = $1",
      [email]
    );
    expect(rows[0].password_hash).not.toBe(PASSWORD);
    expect(rows[0].password_hash.startsWith("$2")).toBe(true);
  });

  it("rejects duplicate registration with 409", async () => {
    const email = uniqueEmail("dup");
    const payload = { firstName: "A", lastName: "B", email, password: PASSWORD };
    expect((await request(app).post("/api/auth/register").send(payload)).status).toBe(201);
    const second = await request(app).post("/api/auth/register").send(payload);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("rejects a weak password with 400", async () => {
    const res = await request(app).post("/api/auth/register").send({
      firstName: "A",
      lastName: "B",
      email: uniqueEmail("weak"),
      password: "short",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs in, returns the session user, then logs out", async () => {
    const { email } = await registerUser("login");
    const agent = request.agent(app);

    const wrong = await agent
      .post("/api/auth/login")
      .send({ email, password: "WrongPassword1" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");

    const login = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.user.email).toBe(email);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(email);

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(204);

    const meAfter = await agent.get("/api/auth/me");
    expect(meAfter.status).toBe(401);
  });

  it("rejects /api/auth/me without a session", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("cart", () => {
  it("adds an item and calculates totals on the server", async () => {
    const { agent } = await registerUser("cart");
    const variant = await firstVariantOf(1);

    const res = await addToCart(agent, variant.id, 2);
    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(1);

    const item = res.body.data.items[0];
    expect(item.variantId).toBe(variant.id);
    expect(item.quantity).toBe(2);
    expect(item.attributes).toEqual([variant.size, variant.color]);
    expect(res.body.data.totals.totalQuantity).toBe(2);
    expect(res.body.data.totals.total).toBeCloseTo(item.unitPrice * 2, 5);

    const cart = await agent.get("/api/cart");
    expect(cart.status).toBe(200);
    expect(cart.body.data.items).toHaveLength(1);
  });

  it("refuses quantities above available stock", async () => {
    const { agent } = await registerUser("stock");
    const variant = await firstVariantOf(1);
    await pool.query("UPDATE inventory SET quantity = 3 WHERE variant_id = $1", [variant.id]);

    const res = await addToCart(agent, variant.id, 4);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(res.body.error.details.available).toBe(3);
  });

  it("updates and deletes cart items", async () => {
    const { agent } = await registerUser("update");
    const variant = await firstVariantOf(2);
    const added = await addToCart(agent, variant.id, 1);
    const itemId = added.body.data.items[0].id;

    const patched = await agent.patch(`/api/cart/items/${itemId}`).send({ quantity: 3 });
    expect(patched.status).toBe(200);
    expect(patched.body.data.items[0].quantity).toBe(3);

    const tooMany = await agent.patch(`/api/cart/items/${itemId}`).send({ quantity: 500 });
    expect(tooMany.status).toBe(400);

    const deleted = await agent.delete(`/api/cart/items/${itemId}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.items).toHaveLength(0);
  });

  it("supports guest carts through a cookie", async () => {
    const guest = request.agent(app);
    const variant = await firstVariantOf(3);

    const added = await addToCart(guest, variant.id, 1);
    expect(added.status).toBe(201);
    expect((added.headers["set-cookie"]?.[0] ?? "")).toContain("shopsphere_cart=");

    const cart = await guest.get("/api/cart");
    expect(cart.body.data.items).toHaveLength(1);
  });

  it("rejects a malformed variant id", async () => {
    const { agent } = await registerUser("bad");
    const res = await agent
      .post("/api/cart/items")
      .send({ variantId: "not-a-uuid", quantity: 1 });
    expect(res.status).toBe(400);
  });
});

describe("orders", () => {
  it("places an order, decrements stock and writes the outbox event", async () => {
    const { agent, user } = await registerUser("order");
    const variant = await firstVariantOf(4);

    await pool.query("UPDATE inventory SET quantity = 10 WHERE variant_id = $1", [variant.id]);
    expect((await addToCart(agent, variant.id, 2)).status).toBe(201);

    const res = await agent
      .post("/api/orders")
      .set("Idempotency-Key", `key-${Date.now()}-success`)
      .send(orderPayload());

    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order.status).toBe("confirmed");
    expect(order.orderNumber).toMatch(/^SS-\d{8}-[0-9A-F]{6}$/);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ variantId: variant.id, quantity: 2 });
    expect(order.total).toBeCloseTo(order.items[0].unitPrice * 2, 5);

    const stock = await pool.query<{ quantity: number }>(
      "SELECT quantity FROM inventory WHERE variant_id = $1",
      [variant.id]
    );
    expect(stock.rows[0].quantity).toBe(8);

    const events = await pool.query<{ event_type: string; payload: Record<string, unknown> }>(
      "SELECT event_type, payload FROM outbox_events WHERE aggregate_id = $1::uuid OR payload->>'order_id' = $1::text",
      [order.id]
    );
    const placed = events.rows.filter((row) => row.event_type === "order.placed");
    expect(placed).toHaveLength(1);
    expect(placed[0].payload).toMatchObject({
      event_type: "order.placed",
      event_version: 1,
    });
    expect((placed[0].payload as { order: { id: string } }).order.id).toBe(order.id);

    const dbOrder = await pool.query("SELECT user_id FROM orders WHERE id = $1", [order.id]);
    expect(dbOrder.rows[0].user_id).toBe(user.id);
  });

  it("rejects an order when stock is insufficient and writes nothing", async () => {
    const { agent } = await registerUser("nostock");
    const variant = await firstVariantOf(5);
    await pool.query("UPDATE inventory SET quantity = 2 WHERE variant_id = $1", [variant.id]);
    await addToCart(agent, variant.id, 2);

    // Someone else buys the units first.
    await pool.query("UPDATE inventory SET quantity = 0 WHERE variant_id = $1", [variant.id]);

    const res = await agent
      .post("/api/orders")
      .set("Idempotency-Key", `key-${Date.now()}-fail`)
      .send(orderPayload());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");

    const orders = await pool.query("SELECT COUNT(*)::text AS count FROM orders");
    expect(Number(orders.rows[0].count)).toBe(0);

    const events = await pool.query("SELECT COUNT(*)::text AS count FROM outbox_events");
    expect(Number(events.rows[0].count)).toBe(0);

    const stock = await pool.query<{ quantity: number }>(
      "SELECT quantity FROM inventory WHERE variant_id = $1",
      [variant.id]
    );
    expect(stock.rows[0].quantity).toBe(0);
  });

  it("requires an Idempotency-Key header", async () => {
    const { agent } = await registerUser("nokey");
    const variant = await firstVariantOf(6);
    await addToCart(agent, variant.id, 1);

    const res = await agent.post("/api/orders").send(orderPayload());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("returns the original order for a repeated idempotency key", async () => {
    const { agent } = await registerUser("idem");
    const variant = await firstVariantOf(7);
    await addToCart(agent, variant.id, 1);

    const key = `key-${Date.now()}-idem`;
    const first = await agent.post("/api/orders").set("Idempotency-Key", key).send(orderPayload());
    expect(first.status).toBe(201);

    const second = await agent.post("/api/orders").set("Idempotency-Key", key).send(orderPayload());
    expect(second.status).toBe(200);
    expect(second.body.meta.idempotentReplay).toBe(true);
    expect(second.body.data.id).toBe(first.body.data.id);

    const orders = await pool.query("SELECT COUNT(*)::text AS count FROM orders");
    expect(Number(orders.rows[0].count)).toBe(1);
  });

  it("lists order history and hides other users' orders", async () => {
    const buyer = await registerUser("buyer");
    const other = await registerUser("other");
    const variant = await firstVariantOf(8);
    await addToCart(buyer.agent, variant.id, 1);

    const placed = await buyer.agent
      .post("/api/orders")
      .set("Idempotency-Key", `key-${Date.now()}-history`)
      .send(orderPayload());
    expect(placed.status).toBe(201);

    const list = await buyer.agent.get("/api/orders");
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.pagination.total).toBe(1);

    const detail = await buyer.agent.get(`/api/orders/${placed.body.data.id}`);
    expect(detail.status).toBe(200);

    const forbidden = await other.agent.get(`/api/orders/${placed.body.data.id}`);
    expect(forbidden.status).toBe(404);

    const anonymous = await request(app).get("/api/orders");
    expect(anonymous.status).toBe(401);
  });

  it("only lets one of two simultaneous buyers get the last unit", async () => {
    const buyerA = await registerUser("race-a");
    const buyerB = await registerUser("race-b");
    const variant = await firstVariantOf(12);

    await pool.query("UPDATE inventory SET quantity = 1 WHERE variant_id = $1", [variant.id]);
    expect((await addToCart(buyerA.agent, variant.id, 1)).status).toBe(201);
    expect((await addToCart(buyerB.agent, variant.id, 1)).status).toBe(201);

    const [first, second] = await Promise.all([
      buyerA.agent
        .post("/api/orders")
        .set("Idempotency-Key", `key-${Date.now()}-race-a`)
        .send(orderPayload()),
      buyerB.agent
        .post("/api/orders")
        .set("Idempotency-Key", `key-${Date.now()}-race-b`)
        .send(orderPayload()),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const loser = first.status === 409 ? first : second;
    expect(loser.body.error.code).toBe("INSUFFICIENT_STOCK");

    const stock = await pool.query<{ quantity: number }>(
      "SELECT quantity FROM inventory WHERE variant_id = $1",
      [variant.id]
    );
    expect(stock.rows[0].quantity).toBe(0);

    const orders = await pool.query("SELECT COUNT(*)::text AS count FROM orders");
    expect(Number(orders.rows[0].count)).toBe(1);

    const events = await pool.query(
      "SELECT COUNT(*)::text AS count FROM outbox_events WHERE event_type = 'order.placed'"
    );
    expect(Number(events.rows[0].count)).toBe(1);
  });
});
