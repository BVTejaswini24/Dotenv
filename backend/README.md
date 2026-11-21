# ShopSphere Backend (Express + TypeScript + PostgreSQL)

Backend for the ShopSphere storefront. PostgreSQL is the source of truth for
products, carts, orders and stock; `order.placed` events are written to a
transactional outbox for the Kafka/OpenSearch member of the team.

**Current status:** all APIs, migrations, seed and tests are implemented and
pass locally against a real PostgreSQL 18 instance. The Aiven PostgreSQL
connection has **not** been verified yet because `backend/.env` does not exist
in this checkout. See [Aiven status](#aiven-status).

---

## 1. Requirements

- Node.js 20+ (developed on Node 24)
- PostgreSQL 14+ (Aiven or local)

## 2. Install

```bash
cd backend
npm install
cp .env.example .env
# edit .env with your Aiven credentials + a JWT_SECRET
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL URL. Never commit it. |
| `DATABASE_SSL` | no | `true` for Aiven (SSL with `rejectUnauthorized:false`). |
| `JWT_SECRET` | yes | Signs session tokens, min 32 chars. |
| `PORT` | no | Default `4000`. |
| `CORS_ORIGIN` | no | Comma-separated frontend origins. |
| `SESSION_TTL_DAYS` | no | Session length, default `7`. |
| `COOKIE_SECURE` | no | Defaults to `true` in production, `false` otherwise. |
| `AUTH_RATE_LIMIT_*`, `WRITE_RATE_LIMIT_*` | no | Rate-limit overrides. |
| `TEST_DATABASE_URL` | no | Use an existing throwaway DB for tests. |

`env.ts` throws at startup if `DATABASE_URL` or a valid `JWT_SECRET` is missing.

## 4. Database setup

```bash
npm run migrate            # apply migrations/*.sql (idempotent)
npm run migrate:rollback   # roll back the latest migration (migrations/down)
npm run seed               # import the 38 real frontend products
```

Migrations run in filename order, each in its own transaction, tracked in
`schema_migrations`. Every migration has a matching `migrations/down/*.sql`.

The seed script reads `src/data/catalog.json`, a snapshot of the frontend's
`src/lib/data/products.ts` + `categories.ts`. If the frontend catalogue
changes, regenerate the snapshot and re-seed:

```bash
npm run seed:extract
npm run seed
```

Seeding is idempotent: products are keyed by `legacy_id`, variants by SKU, and
inventory rows are inserted only once (re-seeding never restores sold stock).

## 5. Run

```bash
npm run dev        # tsx watch
npm run build      # compile to dist/
npm start          # node dist/server.js
```

Health check: `GET http://localhost:4000/api/health` → 200 only when the
database answers.

## 6. Tests

```bash
npm test
```

The suite starts a **throwaway embedded PostgreSQL** (port `55432`, data in
`backend/.pgdata-test/`), applies all migrations, seeds the catalogue, runs the
tests and shuts the database down. Set `TEST_DATABASE_URL` to use an existing
database instead — never point it at production, the suite deletes rows.

Covered: health/database connection, product list/pagination/filter/sort,
product detail, categories, registration, login/logout/me, cart add/update/
delete/stock limits/guest carts, successful order, insufficient stock (409,
nothing written), duplicate idempotency key, order history + ownership,
simultaneous last-unit purchase (exactly one 201 and one 409), outbox event
creation, seed idempotency.

## 7. API surface

```
GET    /api/health
GET    /api/products                 ?page&limit&category&gender&minPrice&maxPrice&sort&q
GET    /api/products/:idOrSlug       numeric legacy id, UUID or slug
GET    /api/categories
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/cart
POST   /api/cart/items
PATCH  /api/cart/items/:itemId
DELETE /api/cart/items/:itemId
POST   /api/orders                   requires Idempotency-Key header
GET    /api/orders                   signed-in user's history
GET    /api/orders/:id
```

Full request/response formats: [API_DOCUMENTATION.md](API_DOCUMENTATION.md).
Frontend guide: [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md).
Schema: [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).
Kafka contract: [EVENT_CONTRACT.md](EVENT_CONTRACT.md).

## 8. Order transaction (overselling prevention)

`POST /api/orders` runs a single `BEGIN … COMMIT`:

1. Read cart lines (or explicit `items`), merge duplicates, sort by variant id.
2. `SELECT … FROM product_variants JOIN products` so prices come from the DB.
3. `SELECT variant_id, quantity FROM inventory WHERE variant_id = ANY(...)
   ORDER BY variant_id FOR UPDATE` — rows are locked in a deterministic order,
   so two concurrent checkouts serialize instead of deadlocking.
4. Verify every line has enough stock; otherwise `409 INSUFFICIENT_STOCK`
   (rollback, nothing written, no event).
5. Insert `orders` + `order_items` with price snapshots.
6. `UPDATE inventory SET quantity = quantity - $n WHERE variant_id = $id AND
   quantity >= $n` (guarded again in SQL).
7. Insert `order.placed` (+ one `inventory.updated` per line) into
   `outbox_events` **in the same transaction**.
8. Mark the cart `checked_out`, commit, return the order.

Consequences: PostgreSQL alone decides who gets the last unit; a rolled-back
order can never produce an outbox event; duplicate submissions with the same
`Idempotency-Key` return the original order (`200`, `meta.idempotentReplay:true`)
rather than ordering twice.

## 9. Money

All amounts are stored as integer minor units in `BIGINT` columns
(`price_paise`, `total_paise`, …). The API returns major units (e.g. `120`
for `$120`) because the existing frontend renders plain numbers. The database
never uses floating-point money.

## 10. Seed data notes

The frontend's 38 products have IDs 1–8 and 12–41 (9–11 do not exist), so the
seed and the API use `legacy_id` — never array positions. Each product is seeded
with one variant per size/color combination; the frontend's `stock` value is
used as the stock of **each** variant. The API exposes `stock` as the largest
per-variant stock (what the UI caps quantities at) and the exact per-variant
stock in `variants[]`.

## 11. Aiven status

- Aiven PostgreSQL service exists in the team account.
- `backend/.env` is **not present**, so no connection test has been run and no
  migrations/seed have been executed against Aiven.
- Run `npm run migrate && npm run seed` once `.env` contains the rotated
  connection string, then check `GET /api/health`.

## 12. Security notes

- Passwords hashed with bcrypt (bcryptjs, cost 10); hashes never leave the DB.
- Sessions are JWTs in an `HttpOnly`, `SameSite=Lax` cookie (Secure in
  production); the token is never returned in JSON and never stored in
  localStorage.
- Auth endpoints and cart/order writes are rate limited.
- Every SQL statement uses bound parameters.
- Errors are normalized by one middleware: `{ error: { code, message, details? } }`;
  unexpected errors are logged server-side without credentials.
- `.env*` is gitignored (except `.env.example`); logs never print the
  connection string or password.

## 13. Known gaps / next steps

- Promo/signup discounts are computed in the browser today; the server
  currently ignores them (`discount_paise = 0`). Move promo rules server-side
  before launch.
- Guest carts are supported, but a guest cart is not merged into the user cart
  on login yet.
- Payment is recorded as a method only (`card`/`upi`/`cod`); no payment gateway.
- `GET /api/search` (OpenSearch) is Member 3's endpoint; `/api/products?q=` is a
  temporary SQL `ILIKE` fallback.
- Reviews table exists; review endpoints are not part of this phase.
- Aiven connectivity, migrations and seed against Aiven remain pending (no
  credentials in the checkout).
