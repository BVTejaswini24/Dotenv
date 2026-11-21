import { Product } from "@/types/product.types";

function getEffectivePrice(product: Product): number {
  if (product.discount.percentage > 0) {
    return Math.round(
      product.price - (product.price * product.discount.percentage) / 100
    );
  }
  if (product.discount.amount > 0) {
    return product.price - product.discount.amount;
  }
  return product.price;
}

function scoreProduct(candidate: Product, source: Product): number {
  let score = 0;
  const sourcePrice = getEffectivePrice(source);
  const candidatePrice = getEffectivePrice(candidate);

  // Category match — highest signal
  if (candidate.category === source.category) score += 40;

  // Gender match (unisex products match everyone)
  if (
    candidate.gender === source.gender ||
    candidate.gender === "unisex" ||
    source.gender === "unisex"
  ) {
    score += 20;
  }

  // Subcategory match
  if (
    candidate.subcategory &&
    source.subcategory &&
    candidate.subcategory === source.subcategory
  ) {
    score += 15;
  }

  // Same style
  if (
    candidate.style &&
    source.style &&
    candidate.style.toLowerCase() === source.style.toLowerCase()
  ) {
    score += 10;
  }

  // Same brand
  if (candidate.brand === source.brand) score += 10;

  // Price similarity: within 30% gets full points; degrades linearly
  if (sourcePrice > 0) {
    const priceDiff = Math.abs(candidatePrice - sourcePrice) / sourcePrice;
    if (priceDiff <= 0.1) {
      score += 20;
    } else if (priceDiff <= 0.2) {
      score += 15;
    } else if (priceDiff <= 0.3) {
      score += 10;
    } else if (priceDiff <= 0.5) {
      score += 5;
    }
  }

  // High rating
  if (candidate.rating >= 4.5) score += 10;
  else if (candidate.rating >= 4.0) score += 6;
  else if (candidate.rating >= 3.5) score += 3;

  // Bestseller / featured
  if (candidate.isFeatured) score += 5;
  if (candidate.isBestSeller) score += 5;

  // Tags overlap
  const sourceTags = source.tags ?? [];
  const candidateTags = candidate.tags ?? [];
  let tagOverlap = 0;
  for (const tag of candidateTags) {
    if (sourceTags.includes(tag)) tagOverlap++;
  }
  score += Math.min(tagOverlap * 3, 15);

  return score;
}

/**
 * Returns scored alternative products for an out-of-stock product.
 * Never returns the source product itself; never returns out-of-stock products.
 * Returns up to `limit` products ordered by relevance score.
 */
export function getAlternatives(
  sourceProduct: Product,
  allProducts: Product[],
  limit = 6
): Product[] {
  const candidates = allProducts.filter(
    (p) =>
      p.id !== sourceProduct.id && // not itself
      (p.stock === undefined || p.stock > 0) // must be in stock
  );

  const scored = candidates
    .map((p) => ({ product: p, score: scoreProduct(p, sourceProduct) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ product }) => product);
}
