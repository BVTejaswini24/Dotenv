/**
 * src/opensearch/product-document.ts
 *
 * Maps a PostgreSQL product row (joined with its category and active variants)
 * to the document shape stored in the `shopsphere_products` OpenSearch index.
 *
 * The output field names match PRODUCT_INDEX_MAPPINGS in ./index-setup.ts and
 * the snake_case event contract in ../types.ts.
 *
 * Money: PostgreSQL stores minor units (paise/cents) in BIGINT columns.
 * The search document stores major units, matching the backend API and the
 * product.updated event payload.
 *
 * This module is pure — it performs no I/O and opens no connections — so it can
 * be reused by both the backfill script and the Kafka product.updated handler.
 */

// ---------------------------------------------------------------------------
// Source rows (shape returned by the backfill SELECT)
// ---------------------------------------------------------------------------

export interface ProductVariantSource {
  variant_id: string;
  sku: string;
  size: string;
  color: string;
  price_paise: string | number;
  stock: number | string;
}

export interface ProductSourceRow {
  id: string;
  legacy_id: number | null;
  slug: string;
  title: string;
  description: string | null;
  brand: string | null;
  subcategory: string | null;
  gender: string | null;
  tags: string[] | null;
  image_url: string;
  price_paise: string | number;
  original_price_paise: string | number | null;
  discount_percentage: string | number | null;
  rating: string | number | null;
  review_count: number | string | null;
  is_new: boolean;
  is_featured: boolean;
  is_best_seller: boolean;
  is_on_sale: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  product_sku: string | null;
  category_slug: string;
  category_name: string;
  variants: ProductVariantSource[] | null;
}

// ---------------------------------------------------------------------------
// Search document
// ---------------------------------------------------------------------------

export interface ProductSearchVariant {
  variant_id: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  stock: number;
}

export interface ProductSearchDocument {
  id: number | null;
  uuid: string;
  slug: string;
  title: string;
  description: string;
  brand: string;
  category: string;
  category_name: string;
  subcategory: string | null;
  gender: string | null;
  sku: string | null;
  tags: string[];
  price: number;
  original_price: number | null;
  discount_percentage: number;
  rating: number;
  review_count: number;
  stock: number;
  is_new: boolean;
  is_featured: boolean;
  is_best_seller: boolean;
  is_on_sale: boolean;
  is_active: boolean;
  image_url: string;
  variants: ProductSearchVariant[];
  created_at: string;
  updated_at: string;
}

/**
 * Deterministic OpenSearch document ID.
 *
 * The product UUID is the stable primary key: re-running a backfill (or
 * replaying product.updated) overwrites the same document instead of creating
 * duplicates. The numeric legacy_id is exposed as a field for the frontend but
 * is nullable, so it must not be used as the document ID.
 */
export function productDocumentId(row: Pick<ProductSourceRow, "id">): string {
  return row.id;
}

export function toMajorUnits(minor: string | number | null | undefined): number {
  return Number(minor ?? 0) / 100;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function buildProductDocument(
  row: ProductSourceRow
): ProductSearchDocument {
  const sourceVariants = Array.isArray(row.variants) ? row.variants : [];

  const variants: ProductSearchVariant[] = sourceVariants.map((variant) => ({
    variant_id: variant.variant_id,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    price: toMajorUnits(variant.price_paise),
    stock: Number(variant.stock ?? 0),
  }));

  // Mirrors the backend ProductDto: product stock is the largest active
  // variant stock, so search results agree with the storefront API.
  const stock = variants.reduce((max, variant) => Math.max(max, variant.stock), 0);

  return {
    id: row.legacy_id,
    uuid: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    brand: row.brand ?? "",
    category: row.category_slug,
    category_name: row.category_name,
    subcategory: row.subcategory,
    gender: row.gender,
    sku: row.product_sku,
    tags: row.tags ?? [],
    price: toMajorUnits(row.price_paise),
    original_price:
      row.original_price_paise === null
        ? null
        : toMajorUnits(row.original_price_paise),
    discount_percentage: Number(row.discount_percentage ?? 0),
    rating: Number(row.rating ?? 0),
    review_count: Number(row.review_count ?? 0),
    stock,
    is_new: Boolean(row.is_new),
    is_featured: Boolean(row.is_featured),
    is_best_seller: Boolean(row.is_best_seller),
    is_on_sale: Boolean(row.is_on_sale),
    // The products table has no soft-delete/active column: every row in the
    // catalogue is sellable, so the document is always active.
    is_active: true,
    image_url: row.image_url,
    variants,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}
