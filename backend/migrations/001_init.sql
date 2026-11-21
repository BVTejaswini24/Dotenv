-- ShopSphere initial schema
-- Money is stored as integer paise (1 INR = 100 paise) in BIGINT columns.
-- gen_random_uuid() is built into PostgreSQL 13+, so no extension is required.

-- ---------------------------------------------------------------------------
-- Reusable updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- categories
-- legacy_id keeps a mapping to the numeric IDs used by the current frontend.
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id  INTEGER UNIQUE,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- legacy_id keeps a mapping to the numeric product IDs used by the frontend
-- routes (/shop/product/:id/:slug). The API can expose legacy_id as `id`
-- while the database primary key remains a UUID.
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id              INTEGER UNIQUE,
  slug                   TEXT NOT NULL UNIQUE,
  title                  TEXT NOT NULL,
  description            TEXT NOT NULL DEFAULT '',
  brand                  TEXT NOT NULL DEFAULT 'LUXE',
  category_id            UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory            TEXT,
  gender                 TEXT CHECK (gender IN ('men', 'women', 'kids', 'unisex')),
  style                  TEXT,
  material               TEXT,
  care_instructions      TEXT,
  fit                    TEXT,
  pattern                TEXT,
  tags                   TEXT[] NOT NULL DEFAULT '{}',
  image_url              TEXT NOT NULL,
  gallery                JSONB NOT NULL DEFAULT '[]'::jsonb,
  price_paise            BIGINT NOT NULL CHECK (price_paise >= 0),
  original_price_paise   BIGINT CHECK (original_price_paise >= 0),
  discount_percentage    NUMERIC(5, 2) NOT NULL DEFAULT 0
                         CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  discount_amount_paise  BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount_paise >= 0),
  rating                 NUMERIC(3, 2) NOT NULL DEFAULT 0
                         CHECK (rating >= 0 AND rating <= 5),
  review_count           INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  is_new                 BOOLEAN NOT NULL DEFAULT false,
  is_featured            BOOLEAN NOT NULL DEFAULT false,
  is_best_seller         BOOLEAN NOT NULL DEFAULT false,
  is_on_sale             BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_gender ON products(gender);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- product_variants
-- One row per purchasable size/color combination.
-- ---------------------------------------------------------------------------
CREATE TABLE product_variants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku        TEXT NOT NULL UNIQUE,
  size       TEXT NOT NULL DEFAULT 'One Size',
  color      TEXT NOT NULL DEFAULT 'Default',
  color_hex  TEXT,
  price_paise BIGINT NOT NULL CHECK (price_paise >= 0),
  image_url  TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_product_size_color_unique
    UNIQUE (product_id, size, color)
);

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);

CREATE TRIGGER trg_product_variants_updated_at
BEFORE UPDATE ON product_variants
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- inventory
-- Authoritative stock per variant. Order placement must decrement this table
-- inside a transaction with: UPDATE inventory SET quantity = quantity - $qty
-- WHERE variant_id = $id AND quantity >= $qty RETURNING quantity;
-- ---------------------------------------------------------------------------
CREATE TABLE inventory (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_inventory_updated_at
BEFORE UPDATE ON inventory
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- carts
-- One active cart per logged-in user (guest carts may have NULL user_id).
-- ---------------------------------------------------------------------------
CREATE TABLE carts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'checked_out', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_carts_active_user
  ON carts(user_id)
  WHERE status = 'active' AND user_id IS NOT NULL;
CREATE INDEX idx_carts_user_id ON carts(user_id);

CREATE TRIGGER trg_carts_updated_at
BEFORE UPDATE ON carts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- cart_items
-- ---------------------------------------------------------------------------
CREATE TABLE cart_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id          UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id       UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paise BIGINT NOT NULL CHECK (unit_price_paise >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_cart_variant_unique UNIQUE (cart_id, variant_id)
);

CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_variant_id ON cart_items(variant_id);

CREATE TRIGGER trg_cart_items_updated_at
BEFORE UPDATE ON cart_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number       TEXT NOT NULL UNIQUE,
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN (
                       'pending', 'confirmed', 'processing',
                       'shipped', 'delivered', 'cancelled', 'failed'
                     )),
  subtotal_paise     BIGINT NOT NULL CHECK (subtotal_paise >= 0),
  discount_paise     BIGINT NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  delivery_fee_paise BIGINT NOT NULL DEFAULT 0 CHECK (delivery_fee_paise >= 0),
  total_paise        BIGINT NOT NULL CHECK (total_paise >= 0),
  currency           CHAR(3) NOT NULL DEFAULT 'INR'
                     CHECK (char_length(currency) = 3),
  shipping_address   JSONB NOT NULL,
  idempotency_key    TEXT UNIQUE,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- order_items
-- Snapshot product name/sku/size/color/price so history survives changes.
-- ---------------------------------------------------------------------------
CREATE TABLE order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id       UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name     TEXT NOT NULL,
  sku              TEXT NOT NULL,
  size             TEXT NOT NULL,
  color            TEXT NOT NULL,
  unit_price_paise BIGINT NOT NULL CHECK (unit_price_paise >= 0),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  line_total_paise BIGINT NOT NULL CHECK (line_total_paise >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);

-- ---------------------------------------------------------------------------
-- outbox_events
-- Written in the same transaction as the business change, then published to
-- Kafka by the outbox relay owned by the Kafka/OpenSearch team member.
-- ---------------------------------------------------------------------------
CREATE TABLE outbox_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type     TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id   UUID NOT NULL,
  payload        JSONB NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'published', 'failed')),
  attempts       INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at   TIMESTAMPTZ,
  last_error     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbox_events_pending
  ON outbox_events(status, available_at)
  WHERE status = 'pending';
CREATE INDEX idx_outbox_events_aggregate
  ON outbox_events(aggregate_type, aggregate_id);

CREATE TRIGGER trg_outbox_events_updated_at
BEFORE UPDATE ON outbox_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
