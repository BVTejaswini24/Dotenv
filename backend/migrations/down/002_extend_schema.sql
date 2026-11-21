-- Rollback for 002_extend_schema.sql
-- Drops only what 002 added; 001 tables stay intact.

DROP TABLE IF EXISTS processed_events;
DROP TABLE IF EXISTS reviews;

ALTER TABLE outbox_events DROP COLUMN IF EXISTS event_version;

DROP INDEX IF EXISTS idx_orders_user_created;

ALTER TABLE orders
  DROP COLUMN IF EXISTS cart_id,
  DROP COLUMN IF EXISTS payment_method,
  DROP COLUMN IF EXISTS delivery_method,
  DROP COLUMN IF EXISTS contact_phone,
  DROP COLUMN IF EXISTS contact_email;

ALTER TABLE orders ALTER COLUMN currency SET DEFAULT 'INR';

DROP INDEX IF EXISTS uq_carts_active_guest;
DROP INDEX IF EXISTS uq_carts_guest_token;
ALTER TABLE carts DROP COLUMN IF EXISTS guest_token;

DROP INDEX IF EXISTS idx_products_rating;
DROP INDEX IF EXISTS idx_products_price;

ALTER TABLE products
  DROP COLUMN IF EXISTS product_sku,
  DROP COLUMN IF EXISTS colors,
  DROP COLUMN IF EXISTS sizes;
