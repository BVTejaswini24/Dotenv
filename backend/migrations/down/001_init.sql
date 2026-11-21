-- Rollback for 001_init.sql
-- Drops every table created by the initial schema, in reverse dependency order.

DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

DROP FUNCTION IF EXISTS set_updated_at();
