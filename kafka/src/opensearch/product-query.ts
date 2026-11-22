/**
 * product-query.ts
 *
 * Single source of truth for the read-only PostgreSQL SELECT that produces a
 * ProductSourceRow. Shared by the one-off backfill and the Kafka consumer's
 * product.updated handler so both always emit the same document shape.
 *
 * This module contains SQL only — it performs no I/O.
 */

export const PRODUCT_SELECT_COLUMNS = `
    p.id,
    p.legacy_id,
    p.slug,
    p.title,
    p.description,
    p.brand,
    p.subcategory,
    p.gender,
    p.tags,
    p.image_url,
    p.price_paise,
    p.original_price_paise,
    p.discount_percentage,
    p.rating,
    p.review_count,
    p.is_new,
    p.is_featured,
    p.is_best_seller,
    p.is_on_sale,
    p.created_at,
    p.updated_at,
    p.product_sku,
    c.slug AS category_slug,
    c.name AS category_name,
    COALESCE(
      json_agg(
        json_build_object(
          'variant_id', v.id,
          'sku', v.sku,
          'size', v.size,
          'color', v.color,
          'price_paise', v.price_paise,
          'stock', COALESCE(i.quantity, 0)
        )
        ORDER BY v.size, v.color
      ) FILTER (WHERE v.id IS NOT NULL),
      '[]'::json
    ) AS variants
  FROM products p
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN product_variants v
    ON v.product_id = p.id AND v.is_active = true
  LEFT JOIN inventory i ON i.variant_id = v.id
`;

export const PRODUCTS_PAGE_SQL = `
  SELECT
${PRODUCT_SELECT_COLUMNS}
  WHERE ($1::uuid IS NULL OR p.id > $1::uuid)
  GROUP BY p.id, c.id, c.slug, c.name
  ORDER BY p.id
  LIMIT $2
`;

export const PRODUCT_BY_UUID_SQL = `
  SELECT
${PRODUCT_SELECT_COLUMNS}
  WHERE p.id = $1::uuid
  GROUP BY p.id, c.id, c.slug, c.name
`;

export const PRODUCT_BY_LEGACY_ID_SQL = `
  SELECT
${PRODUCT_SELECT_COLUMNS}
  WHERE p.legacy_id = $1::int
  GROUP BY p.id, c.id, c.slug, c.name
`;
