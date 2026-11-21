import { z } from "zod";
import { pool } from "../../db/pool";
import { NotFoundError } from "../../lib/errors";
import { effectiveUnitPriceMinor, toMajorUnits } from "../../lib/money";

export type ProductSizeOption = { id: string; name: string; label: string };
export type ProductColorOption = {
  id: string;
  name: string;
  code: string;
  hex?: string;
};

export type ProductVariantDto = {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorCode: string;
  price: number;
  stock: number;
  image?: string;
};

export type ProductDto = {
  id: number;
  slug: string;
  title: string;
  description: string;
  brand: string;
  category: string;
  categoryName: string;
  subcategory?: string;
  gender?: string;
  srcUrl: string;
  thumbnail?: string;
  gallery: string[];
  price: number;
  originalPrice?: number;
  discount: { amount: number; percentage: number };
  rating: number;
  reviewCount: number;
  sizes: ProductSizeOption[];
  colors: ProductColorOption[];
  variants: ProductVariantDto[];
  material?: string;
  careInstructions?: string;
  fit?: string;
  pattern?: string;
  style?: string;
  tags: string[];
  isNew: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isOnSale: boolean;
  stock: number;
  sku?: string;
  createdAt: string;
};

type ProductRow = {
  id: string;
  legacy_id: number;
  slug: string;
  title: string;
  description: string;
  brand: string;
  category_slug: string;
  category_name: string;
  subcategory: string | null;
  gender: string | null;
  style: string | null;
  material: string | null;
  care_instructions: string | null;
  fit: string | null;
  pattern: string | null;
  tags: string[];
  image_url: string;
  gallery: unknown;
  price_paise: string;
  original_price_paise: string | null;
  discount_percentage: string;
  discount_amount_paise: string;
  rating: string;
  review_count: number;
  is_new: boolean;
  is_featured: boolean;
  is_best_seller: boolean;
  is_on_sale: boolean;
  created_at: Date;
  sizes: unknown;
  colors: unknown;
  product_sku: string | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  color: string;
  color_hex: string | null;
  price_paise: string;
  image_url: string | null;
  stock: number;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function mapProduct(row: ProductRow, variants: VariantRow[]): ProductDto {
  const gallery = asArray<string>(row.gallery);
  const variantDtos: ProductVariantDto[] = variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    colorCode: variant.color_hex ?? "",
    price: toMajorUnits(variant.price_paise),
    stock: variant.stock,
    ...(variant.image_url ? { image: variant.image_url } : {}),
  }));

  const stock = variantDtos.reduce(
    (max, variant) => Math.max(max, variant.stock),
    0
  );

  return {
    id: row.legacy_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    brand: row.brand,
    category: row.category_slug,
    categoryName: row.category_name,
    ...(row.subcategory ? { subcategory: row.subcategory } : {}),
    ...(row.gender ? { gender: row.gender } : {}),
    srcUrl: row.image_url,
    thumbnail: gallery[0] ?? row.image_url,
    gallery: gallery.length > 0 ? gallery : [row.image_url],
    price: toMajorUnits(row.price_paise),
    ...(row.original_price_paise
      ? { originalPrice: toMajorUnits(row.original_price_paise) }
      : {}),
    discount: {
      amount: toMajorUnits(row.discount_amount_paise),
      percentage: Number(row.discount_percentage),
    },
    rating: Number(row.rating),
    reviewCount: row.review_count,
    sizes: asArray<ProductSizeOption>(row.sizes),
    colors: asArray<ProductColorOption>(row.colors),
    variants: variantDtos,
    ...(row.material ? { material: row.material } : {}),
    ...(row.care_instructions
      ? { careInstructions: row.care_instructions }
      : {}),
    ...(row.fit ? { fit: row.fit } : {}),
    ...(row.pattern ? { pattern: row.pattern } : {}),
    ...(row.style ? { style: row.style } : {}),
    tags: row.tags ?? [],
    isNew: row.is_new,
    isFeatured: row.is_featured,
    isBestSeller: row.is_best_seller,
    isOnSale: row.is_on_sale,
    stock,
    ...(row.product_sku ? { sku: row.product_sku } : {}),
    createdAt: row.created_at.toISOString(),
  };
}

async function loadVariants(productIds: string[]): Promise<VariantRow[]> {
  if (productIds.length === 0) return [];
  const { rows } = await pool.query<VariantRow>(
    `SELECT v.id, v.product_id, v.sku, v.size, v.color, v.color_hex,
            v.price_paise, v.image_url, COALESCE(i.quantity, 0) AS stock
       FROM product_variants v
       LEFT JOIN inventory i ON i.variant_id = v.id
      WHERE v.product_id = ANY($1::uuid[]) AND v.is_active = true
      ORDER BY v.size, v.color`,
    [productIds]
  );
  return rows;
}

const SORT_SQL: Record<string, string> = {
  relevance: "p.is_featured DESC, p.legacy_id ASC",
  price_asc: "p.price_paise ASC, p.legacy_id ASC",
  price_desc: "p.price_paise DESC, p.legacy_id ASC",
  rating: "p.rating DESC, p.legacy_id ASC",
  newest: "p.created_at DESC, p.legacy_id ASC",
  title: "p.title ASC",
};

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  category: z.string().min(1).max(80).optional(),
  gender: z.enum(["men", "women", "kids", "unisex"]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z
    .enum(["relevance", "price_asc", "price_desc", "rating", "newest", "title"])
    .default("relevance"),
  q: z.string().min(1).max(100).optional(),
  featured: z.enum(["true", "false"]).optional(),
  onSale: z.enum(["true", "false"]).optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export async function listProducts(query: ListProductsQuery) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  const push = (sql: (index: number) => string, value: unknown) => {
    values.push(value);
    conditions.push(sql(values.length));
  };

  if (query.category) push((i) => `c.slug = $${i}`, query.category);
  if (query.gender) push((i) => `p.gender = $${i}`, query.gender);
  // API prices are major units; the column is minor units.
  if (query.minPrice !== undefined) {
    push((i) => `p.price_paise >= $${i}`, Math.round(query.minPrice * 100));
  }
  if (query.maxPrice !== undefined) {
    push((i) => `p.price_paise <= $${i}`, Math.round(query.maxPrice * 100));
  }
  if (query.featured === "true") conditions.push("p.is_featured = true");
  if (query.onSale === "true") conditions.push("p.is_on_sale = true");
  if (query.q) {
    push(
      (i) => `(p.title ILIKE '%' || $${i} || '%' OR p.description ILIKE '%' || $${i} || '%'
              OR EXISTS (SELECT 1 FROM unnest(p.tags) AS tag WHERE tag ILIKE '%' || $${i} || '%'))`,
      query.q
    );
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
       FROM products p
       JOIN categories c ON c.id = p.category_id
      ${where}`,
    values
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const offset = (query.page - 1) * query.limit;
  const listValues = [...values, query.limit, offset];
  const { rows } = await pool.query<ProductRow>(
    `SELECT p.*, c.slug AS category_slug, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
      ${where}
      ORDER BY ${SORT_SQL[query.sort] ?? SORT_SQL.relevance}
      LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );

  const variants = await loadVariants(rows.map((row) => row.id));
  const byProduct = new Map<string, VariantRow[]>();
  for (const variant of variants) {
    const bucket = byProduct.get(variant.product_id) ?? [];
    bucket.push(variant);
    byProduct.set(variant.product_id, bucket);
  }

  return {
    products: rows.map((row) => mapProduct(row, byProduct.get(row.id) ?? [])),
    total,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Accepts the frontend's numeric id, a UUID, or a slug. */
export async function getProduct(idOrSlug: string): Promise<ProductDto> {
  let sql: string;
  let value: string | number;

  if (/^\d+$/.test(idOrSlug)) {
    sql = "SELECT p.*, c.slug AS category_slug, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.legacy_id = $1";
    value = Number(idOrSlug);
  } else if (UUID_RE.test(idOrSlug)) {
    sql = "SELECT p.*, c.slug AS category_slug, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = $1";
    value = idOrSlug;
  } else {
    sql = "SELECT p.*, c.slug AS category_slug, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.slug = $1";
    value = idOrSlug;
  }

  const { rows } = await pool.query<ProductRow>(sql, [value]);
  const row = rows[0];
  if (!row) {
    throw new NotFoundError("Product not found", "PRODUCT_NOT_FOUND");
  }

  const variants = await loadVariants([row.id]);
  return mapProduct(row, variants);
}

export async function listCategories() {
  const { rows } = await pool.query<{
    legacy_id: number;
    name: string;
    slug: string;
    product_count: string;
  }>(
    `SELECT c.legacy_id, c.name, c.slug, COUNT(p.id)::text AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id, c.legacy_id, c.name, c.slug
      ORDER BY c.legacy_id ASC NULLS LAST`
  );

  return rows.map((row) => ({
    id: row.legacy_id,
    name: row.name,
    slug: row.slug,
    productCount: Number(row.product_count),
  }));
}

/** Used by the cart/order code to price a variant from database values. */
export async function getVariantPricing(variantId: string) {
  const { rows } = await pool.query<{
    variant_id: string;
    product_id: string;
    legacy_id: number;
    sku: string;
    size: string;
    color: string;
    price_paise: string;
    discount_percentage: string;
    discount_amount_paise: string;
    title: string;
    image_url: string;
    slug: string;
  }>(
    `SELECT v.id AS variant_id, p.id AS product_id, p.legacy_id, v.sku, v.size, v.color,
            v.price_paise, p.discount_percentage, p.discount_amount_paise,
            p.title, p.image_url, p.slug
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
      WHERE v.id = $1 AND v.is_active = true`,
    [variantId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    unitPriceMinor: effectiveUnitPriceMinor({
      pricePaise: row.price_paise,
      discountPercentage: row.discount_percentage,
      discountAmountPaise: row.discount_amount_paise,
    }),
  };
}
