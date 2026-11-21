-- ShopSphere schema extension
--
-- Adds the pieces the API layer needs on top of 001_init.sql:
--   * display metadata for product sizes/colors (kept exactly as the frontend has it)
--   * guest carts
--   * order contact / delivery / payment fields
--   * reviews
--   * processed_events (consumer-side idempotency for Member 3)
--   * outbox event versioning
--
-- Money is still stored as integer minor units (paise/cents) in BIGINT columns.

-- ---------------------------------------------------------------------------
-- products: preserve the frontend's size/color option metadata
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sizes  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS product_sku TEXT;

CREATE INDEX IF NOT EXISTS idx_products_price ON products(price_paise);
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating DESC);

-- ---------------------------------------------------------------------------
-- carts: guest carts keyed by an opaque cookie token
-- ---------------------------------------------------------------------------
ALTER TABLE carts
  ADD COLUMN IF NOT EXISTS guest_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_carts_guest_token
  ON carts(guest_token)
  WHERE guest_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_carts_active_guest
  ON carts(guest_token)
  WHERE status = 'active' AND guest_token IS NOT NULL;

-- ---------------------------------------------------------------------------
-- orders: contact + delivery + payment information from the checkout form
-- ---------------------------------------------------------------------------
ALTER TABLE orders
  ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS contact_email   TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'standard'
    CHECK (delivery_method IN ('standard', 'express')),
  ADD COLUMN IF NOT EXISTS payment_method  TEXT NOT NULL DEFAULT 'cod'
    CHECK (payment_method IN ('card', 'upi', 'cod')),
  ADD COLUMN IF NOT EXISTS cart_id         UUID REFERENCES carts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON orders(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- outbox_events: explicit event version for schema evolution
-- ---------------------------------------------------------------------------
ALTER TABLE outbox_events
  ADD COLUMN IF NOT EXISTS event_version INTEGER NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title      TEXT,
  body       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reviews_product_user_unique UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews;
CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- processed_events
-- Consumer-side idempotency ledger. Member 3's Kafka consumer inserts
-- (consumer, event_id) inside the same transaction as its side effect; a
-- duplicate delivery hits the primary key and can be skipped safely.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_events (
  consumer     TEXT NOT NULL,
  event_id     UUID NOT NULL,
  event_type   TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, event_id)
);

CREATE INDEX IF NOT EXISTS idx_processed_events_processed_at
  ON processed_events(processed_at);
