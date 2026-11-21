# ShopSphere Database Schema

PostgreSQL is the source of truth for catalogue, carts, orders **and stock**.
Money is stored as integer minor units (`BIGINT`, e.g. paise/cents) — never
floating point. All primary keys are UUIDs (`gen_random_uuid()`, built into
PostgreSQL 13+; no extension needed).

Migrations: `migrations/001_init.sql`, `migrations/002_extend_schema.sql`.
Every migration has a rollback in `migrations/down/`.

---

## Tables

### `users`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `email` | TEXT UNIQUE NOT NULL | stored lower-case |
| `password_hash` | TEXT NOT NULL | bcrypt, never returned by the API |
| `first_name`, `last_name` | TEXT NOT NULL | |
| `phone` | TEXT | |
| `role` | TEXT | `customer` \| `admin` |
| `created_at`, `updated_at` | TIMESTAMPTZ | trigger-maintained |

### `categories`
| Column | Notes |
| --- | --- |
| `id` UUID PK | |
| `legacy_id` INTEGER UNIQUE | frontend category id (1–8) |
| `name`, `slug` | `slug` unique, used by `?category=` |

### `products`
| Column | Notes |
| --- | --- |
| `id` UUID PK | internal |
| `legacy_id` INTEGER UNIQUE | frontend product id (1–8, 12–41); exposed as `id` |
| `slug` TEXT UNIQUE | |
| `title`, `description`, `brand` | |
| `category_id` UUID FK → categories | `ON DELETE RESTRICT` |
| `subcategory`, `gender`, `style`, `material`, `care_instructions`, `fit`, `pattern` | frontend display metadata |
| `tags` TEXT[] | |
| `image_url`, `gallery` JSONB | `srcUrl` and gallery from the frontend |
| `price_paise`, `original_price_paise` | BIGINT minor units |
| `discount_percentage` NUMERIC(5,2), `discount_amount_paise` | |
| `rating` NUMERIC(3,2), `review_count` | |
| `is_new`, `is_featured`, `is_best_seller`, `is_on_sale` | booleans |
| `sizes` JSONB, `colors` JSONB | exact `sizes`/`colors` arrays from the frontend |
| `product_sku` TEXT | |
| `created_at`, `updated_at` | TIMESTAMPTZ |

Indexes: `category_id`, `gender`, `created_at DESC`, `price_paise`, `rating DESC`.

### `product_variants`
One row per purchasable **size × color** combination.

| Column | Notes |
| --- | --- |
| `id` UUID PK | this is the `variantId` used by cart/order APIs |
| `product_id` UUID FK → products | `ON DELETE CASCADE` |
| `sku` TEXT UNIQUE | e.g. `LX-TS-001-S-BROWN` |
| `size`, `color`, `color_hex` | match the frontend labels/names |
| `price_paise` | BIGINT |
| `image_url`, `is_active` | |
| UNIQUE (`product_id`, `size`, `color`) | |

### `inventory`
Authoritative stock. Exactly one row per variant.

| Column | Notes |
| --- | --- |
| `variant_id` UUID UNIQUE FK → product_variants | `ON DELETE CASCADE` |
| `quantity` INTEGER CHECK ≥ 0 | **source of truth** |

Order placement decrements this row inside the order transaction with
`UPDATE inventory SET quantity = quantity - $qty WHERE variant_id = $id AND quantity >= $qty`.

### `carts`
| Column | Notes |
| --- | --- |
| `user_id` UUID FK → users, nullable | authenticated cart |
| `guest_token` TEXT, nullable | guest cart key (HTTP-only cookie) |
| `status` | `active` \| `checked_out` \| `abandoned` |

Partial unique index `uq_carts_active_user` = one active cart per user;
`uq_carts_active_guest` = one active cart per guest token.

### `cart_items`
`cart_id` FK (cascade), `variant_id` FK (restrict), `quantity > 0`,
`unit_price_paise` (price snapshot), UNIQUE (`cart_id`, `variant_id`).

### `orders`
| Column | Notes |
| --- | --- |
| `id` UUID PK | |
| `order_number` TEXT UNIQUE | `SS-YYYYMMDD-XXXXXX` |
| `user_id` UUID FK → users, nullable | guest orders allowed |
| `status` | `pending` \| `confirmed` \| `processing` \| `shipped` \| `delivered` \| `cancelled` \| `failed` |
| `subtotal_paise`, `discount_paise`, `delivery_fee_paise`, `total_paise` | BIGINT, total = subtotal − discount + delivery |
| `currency` CHAR(3) default `USD` | |
| `shipping_address` JSONB | checkout form address |
| `contact_email`, `contact_phone` | |
| `delivery_method` | `standard` \| `express` |
| `payment_method` | `card` \| `upi` \| `cod` |
| `idempotency_key` TEXT UNIQUE | duplicate-submission guard |
| `cart_id` UUID FK → carts (set null) | |
| `notes`, `created_at`, `updated_at` | |

Indexes: `user_id`, `status`, `created_at DESC`, (`user_id`, `created_at DESC`).

### `order_items`
Immutable price snapshot: `order_id` FK (cascade), `variant_id` FK (set null),
`product_name`, `sku`, `size`, `color`, `unit_price_paise`, `quantity`,
`line_total_paise`.

### `outbox_events`
| Column | Notes |
| --- | --- |
| `id` UUID PK | also the `event_id` in the payload |
| `event_type` TEXT | `order.placed`, `inventory.updated`, `product.updated` |
| `aggregate_type`, `aggregate_id` | `order` / `product` / `product_variant` |
| `payload` JSONB | documented contract (see EVENT_CONTRACT.md) |
| `event_version` INTEGER | currently `1` |
| `status` | `pending` \| `published` \| `failed` |
| `attempts`, `available_at`, `published_at`, `last_error` | relay bookkeeping |

Index `idx_outbox_events_pending (status, available_at) WHERE status='pending'`.

### `reviews`
`product_id` FK (cascade), `user_id` FK (set null), `rating` 1–5, `title`,
`body`, UNIQUE (`product_id`, `user_id`) — one review per user per product.

### `processed_events`
`(consumer TEXT, event_id UUID)` composite PK. Consumer-side idempotency: insert
inside the same transaction as the side effect; a duplicate delivery fails the
PK and can be skipped.

### `schema_migrations`
Applied migration filenames (the migration runner's own bookkeeping).

---

## Relationships

```
users 1─n carts 1─n cart_items n─1 product_variants n─1 products n─1 categories
users 1─n orders 1─n order_items n─1 product_variants
product_variants 1─1 inventory
orders 1─n outbox_events (logical: aggregate_id)
products 1─n reviews
```

## Order transaction flow

```
BEGIN
  read cart lines
  SELECT variants + product prices            (no trust in client prices)
  SELECT inventory … ORDER BY variant_id FOR UPDATE
  if any line short → 409 (ROLLBACK: no order, no event, no stock change)
  INSERT orders
  INSERT order_items
  UPDATE inventory SET quantity = quantity - n WHERE variant_id = … AND quantity >= n
  INSERT outbox_events ('order.placed', then one 'inventory.updated' per line)
  UPDATE carts SET status = 'checked_out'
COMMIT
```

The deterministic `ORDER BY variant_id` lock order prevents deadlocks between
concurrent checkouts. Because inventory locking and the outbox insert share one
transaction, Kafka can never observe an order that was rolled back.

## Seed mapping

`src/data/catalog.json` is a snapshot of the frontend catalogue.
`src/db/seed.ts` maps it:

| Frontend | Database |
| --- | --- |
| `id` | `products.legacy_id` |
| `price` / `originalPrice` | `price_paise` / `original_price_paise` (×100) |
| `discount.percentage` / `.amount` | `discount_percentage` / `discount_amount_paise` |
| `category` (slug) | `categories.slug` |
| `sizes` / `colors` | `products.sizes` / `products.colors` JSONB |
| `sizes[].label` × `colors[].name` | one `product_variants` row per combination |
| `stock` | `inventory.quantity` for each variant (inserted once) |
| `srcUrl`, `gallery`, `tags`, flags, `rating`, `reviewCount` | matching columns |
