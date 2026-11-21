import type { PoolClient } from "pg";
import catalog from "../data/catalog.json";

/**
 * Seeds PostgreSQL from the frontend's real catalogue (src/lib/data/products.ts,
 * snapshotted into src/data/catalog.json by `npm run seed:extract`).
 *
 * Idempotent: products are keyed by legacy_id, variants by SKU and inventory
 * rows are only inserted once, so re-running never duplicates products and
 * never restores stock that customers already bought.
 */

type CatalogDiscount = { amount?: number; percentage?: number };
type CatalogSize = { id: string; name: string; label: string };
type CatalogColor = { id: string; name: string; code: string; hex?: string };

type CatalogProduct = {
  id: number;
  slug: string;
  title: string;
  description?: string;
  brand?: string;
  category: string;
  subcategory?: string;
  gender?: "men" | "women" | "kids" | "unisex";
  srcUrl: string;
  thumbnail?: string;
  gallery?: string[];
  price: number;
  originalPrice?: number;
  discount?: CatalogDiscount;
  rating?: number;
  reviewCount?: number;
  sizes?: CatalogSize[];
  colors?: CatalogColor[];
  material?: string;
  careInstructions?: string;
  fit?: string;
  pattern?: string;
  style?: string;
  tags?: string[];
  isNew?: boolean;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isOnSale?: boolean;
  stock?: number;
  sku?: string;
  createdAt?: string;
};

export type SeedResult = {
  categories: number;
  products: number;
  variants: number;
  inventoryRows: number;
};

function toMinor(value: number | undefined): number {
  return Math.round((value ?? 0) * 100);
}

function skuPart(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function seedCatalog(client: PoolClient): Promise<SeedResult> {
  const categories = catalog.categories as { id: number; name: string; slug: string }[];
  const products = catalog.products as CatalogProduct[];

  const result: SeedResult = {
    categories: 0,
    products: 0,
    variants: 0,
    inventoryRows: 0,
  };

  const categoryIds = new Map<string, string>();

  for (const category of categories) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO categories (legacy_id, name, slug)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, legacy_id = EXCLUDED.legacy_id
       RETURNING id`,
      [category.id, category.name, category.slug]
    );
    categoryIds.set(category.slug, rows[0].id);
    result.categories += 1;
  }

  for (const product of products) {
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) {
      throw new Error(
        `Product ${product.id} references unknown category "${product.category}"`
      );
    }

    const discountPercentage = product.discount?.percentage ?? 0;
    const discountAmount = toMinor(product.discount?.amount ?? 0);
    const gallery = product.gallery ?? [product.srcUrl];

    const { rows: productRows } = await client.query<{ id: string }>(
      `INSERT INTO products (
         legacy_id, slug, title, description, brand, category_id, subcategory,
         gender, style, material, care_instructions, fit, pattern, tags,
         image_url, gallery, price_paise, original_price_paise,
         discount_percentage, discount_amount_paise, rating, review_count,
         is_new, is_featured, is_best_seller, is_on_sale,
         sizes, colors, product_sku, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
         $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
         $27, $28, $29, COALESCE($30::timestamptz, now())
       )
       ON CONFLICT (legacy_id) DO UPDATE SET
         slug = EXCLUDED.slug,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         brand = EXCLUDED.brand,
         category_id = EXCLUDED.category_id,
         subcategory = EXCLUDED.subcategory,
         gender = EXCLUDED.gender,
         style = EXCLUDED.style,
         material = EXCLUDED.material,
         care_instructions = EXCLUDED.care_instructions,
         fit = EXCLUDED.fit,
         pattern = EXCLUDED.pattern,
         tags = EXCLUDED.tags,
         image_url = EXCLUDED.image_url,
         gallery = EXCLUDED.gallery,
         price_paise = EXCLUDED.price_paise,
         original_price_paise = EXCLUDED.original_price_paise,
         discount_percentage = EXCLUDED.discount_percentage,
         discount_amount_paise = EXCLUDED.discount_amount_paise,
         rating = EXCLUDED.rating,
         review_count = EXCLUDED.review_count,
         is_new = EXCLUDED.is_new,
         is_featured = EXCLUDED.is_featured,
         is_best_seller = EXCLUDED.is_best_seller,
         is_on_sale = EXCLUDED.is_on_sale,
         sizes = EXCLUDED.sizes,
         colors = EXCLUDED.colors,
         product_sku = EXCLUDED.product_sku
       RETURNING id`,
      [
        product.id,
        product.slug,
        product.title,
        product.description ?? "",
        product.brand ?? "LUXE",
        categoryId,
        product.subcategory ?? null,
        product.gender ?? null,
        product.style ?? null,
        product.material ?? null,
        product.careInstructions ?? null,
        product.fit ?? null,
        product.pattern ?? null,
        product.tags ?? [],
        product.srcUrl,
        JSON.stringify(gallery),
        toMinor(product.price),
        product.originalPrice === undefined ? toMinor(product.price) : toMinor(product.originalPrice),
        discountPercentage,
        discountAmount,
        product.rating ?? 0,
        product.reviewCount ?? 0,
        product.isNew ?? false,
        product.isFeatured ?? false,
        product.isBestSeller ?? false,
        product.isOnSale ?? false,
        JSON.stringify(product.sizes ?? []),
        JSON.stringify(product.colors ?? []),
        product.sku ?? null,
        product.createdAt ?? null,
      ]
    );

    const productId = productRows[0].id;
    result.products += 1;

    // The frontend has no variant rows, but the cart is keyed by size + color.
    // One variant per size/color combination keeps stock authoritative per SKU.
    const sizes = product.sizes?.length ? product.sizes.map((size) => size.label) : ["One Size"];
    const colors = product.colors?.length ? product.colors : [{ id: "default", name: "Default", code: "bg-black" }];
    const stock = product.stock ?? 0;

    for (const size of sizes) {
      for (const color of colors) {
        const sku = skuPart(`${product.sku ?? `LX-${product.id}`}-${size}-${color.name}`);

        const { rows: variantRows } = await client.query<{ id: string }>(
          `INSERT INTO product_variants
             (product_id, sku, size, color, color_hex, price_paise, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (sku) DO UPDATE SET
             product_id = EXCLUDED.product_id,
             size = EXCLUDED.size,
             color = EXCLUDED.color,
             color_hex = EXCLUDED.color_hex,
             price_paise = EXCLUDED.price_paise,
             image_url = EXCLUDED.image_url
           RETURNING id`,
          [
            productId,
            sku,
            size,
            color.name,
            "hex" in color ? color.hex ?? null : null,
            toMinor(product.price),
            product.srcUrl,
          ]
        );

        await client.query(
          `INSERT INTO inventory (variant_id, quantity)
           VALUES ($1, $2)
           ON CONFLICT (variant_id) DO NOTHING`,
          [variantRows[0].id, stock]
        );

        result.variants += 1;
        result.inventoryRows += 1;
      }
    }
  }

  return result;
}
