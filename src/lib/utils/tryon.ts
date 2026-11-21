import { Product } from "@/types/product.types";
import { TryOnCategory, TryOnProduct, TryOnType } from "@/types/tryon.types";

/** Transparent PNG overlays available in /public/images/tryon. */
export const GLASSES_OVERLAY_ASSETS = {
  classic: "/images/tryon/classic-sunglasses.png",
  aviator: "/images/tryon/aviator-sunglasses.png",
} as const;

const GLASSES_OVERLAY_BY_ID: Record<number, string> = {
  33: GLASSES_OVERLAY_ASSETS.classic,
  142: GLASSES_OVERLAY_ASSETS.aviator,
};

/**
 * Resolves the overlay for a specific glasses product.
 *
 * Known catalogue ids win, then the product title, then a stable id/title
 * hash. The fallback is deterministic so switching between two products can
 * never silently keep the previous product's overlay.
 */
export function getGlassesOverlay(product: {
  id?: number;
  title?: string;
  overlayUrl?: string;
}): string {
  if (product.overlayUrl === GLASSES_OVERLAY_ASSETS.aviator) {
    return GLASSES_OVERLAY_ASSETS.aviator;
  }
  if (product.overlayUrl === GLASSES_OVERLAY_ASSETS.classic) {
    return GLASSES_OVERLAY_ASSETS.classic;
  }

  if (product.id !== undefined && GLASSES_OVERLAY_BY_ID[product.id]) {
    return GLASSES_OVERLAY_BY_ID[product.id];
  }

  const title = (product.title || "").toLowerCase();
  if (/aviator|pilot|teardrop|versace/.test(title)) {
    return GLASSES_OVERLAY_ASSETS.aviator;
  }
  if (/classic|round|retro|wayfarer|square/.test(title)) {
    return GLASSES_OVERLAY_ASSETS.classic;
  }

  const key =
    product.id ??
    Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return key % 2 === 0
    ? GLASSES_OVERLAY_ASSETS.aviator
    : GLASSES_OVERLAY_ASSETS.classic;
}

/**
 * Curated flagship products for the 3 target categories
 */
export const FEATURED_TRYON_PRODUCTS: TryOnProduct[] = [
  // 1. Men's Shirt
  {
    id: 3,
    title: "Checkered Shirt",
    category: "shirts",
    tryOnCategory: "shirt",
    tryOnType: "clothing_ai",
    srcUrl: "/images/product-3.jpg",
    price: 180,
    brand: "LUXE",
    gender: "men",
  },
  {
    id: 54,
    title: "Prada Tailored Italian Poplin Dress Shirt",
    category: "shirts",
    tryOnCategory: "shirt",
    tryOnType: "clothing_ai",
    srcUrl: "/images/products/shirts/product-54.jpg",
    price: 950,
    brand: "Prada",
    gender: "men",
  },
  {
    id: 5,
    title: "Vertical Striped Shirt",
    category: "shirts",
    tryOnCategory: "shirt",
    tryOnType: "clothing_ai",
    srcUrl: "/images/product-5.jpg",
    price: 212,
    brand: "LUXE",
    gender: "men",
  },
  // 2. Sunglasses / Glasses (Real-time AR Face Tracking)
  {
    id: 33,
    title: "Classic Sunglasses",
    category: "accessories",
    tryOnCategory: "glasses",
    tryOnType: "glasses_ar",
    srcUrl: "/images/product-33.jpg",
    price: 120,
    brand: "LUXE",
    gender: "unisex",
    overlayUrl: GLASSES_OVERLAY_ASSETS.classic,
  },
  {
    id: 142,
    title: "Versace Polarized Acetate Aviator Sunglasses",
    category: "accessories",
    tryOnCategory: "glasses",
    tryOnType: "glasses_ar",
    srcUrl: "/images/products/accessories/product-142.jpg",
    price: 360,
    brand: "Versace",
    gender: "unisex",
    overlayUrl: GLASSES_OVERLAY_ASSETS.aviator,
  },
  // 3. Women's Dress / Evening Wear
  {
    id: 60,
    title: "Zara Satin Draped Evening Blouse",
    category: "shirts",
    tryOnCategory: "dress",
    tryOnType: "clothing_ai",
    srcUrl: "/images/products/shirts/product-60.jpg",
    price: 110,
    brand: "Zara",
    gender: "women",
  },
  {
    id: 17,
    title: "Women's Linen Blend Shirt",
    category: "shirts",
    tryOnCategory: "dress",
    tryOnType: "clothing_ai",
    srcUrl: "/images/product-17.jpg",
    price: 130,
    brand: "LUXE",
    gender: "women",
  },
  {
    id: 129,
    title: "Zara Classic Trench Coat with Storm Flap",
    category: "jackets",
    tryOnCategory: "dress",
    tryOnType: "clothing_ai",
    srcUrl: "/images/products/jackets/product-129.jpg",
    price: 260,
    brand: "Zara",
    gender: "women",
  },
];

/**
 * Determines whether a given catalogue product qualifies for Virtual Try-On
 */
export function getTryOnCategory(
  product: Pick<Product, "id" | "title"> & {
    category?: string;
    gender?: string;
    tags?: string[];
  }
): TryOnCategory | null {
  if (!product) return null;

  const id = product.id;
  const title = (product.title || "").toLowerCase();
  const category = (product.category || "").toLowerCase();
  const gender = (product.gender || "").toLowerCase();
  const tags = (product.tags || []).map((t) => t.toLowerCase());

  // Glasses / Sunglasses
  if (
    id === 33 ||
    id === 142 ||
    /sunglass|glasses|eyewear/.test(title) ||
    tags.some((t) => /glass|eyewear/.test(t))
  ) {
    return "glasses";
  }

  // Women's dress / blouse / evening top
  if (
    (gender === "women" &&
      (/dress|blouse|gown|shirt|tunic/.test(title) || category === "shirts" || category === "dresses")) ||
    id === 60 ||
    id === 17 ||
    id === 129
  ) {
    return "dress";
  }

  // Men's shirt
  if (
    id === 3 ||
    id === 5 ||
    id === 54 ||
    (category === "shirts" && gender !== "women") ||
    /shirt|polo/.test(title)
  ) {
    return "shirt";
  }

  return null;
}

export function getTryOnType(category: TryOnCategory): TryOnType {
  return category === "glasses" ? "glasses_ar" : "clothing_ai";
}

export function getCategoryLabel(category: TryOnCategory): string {
  switch (category) {
    case "shirt":
      return "Men's Shirt";
    case "glasses":
      return "Sunglasses & Glasses";
    case "dress":
      return "Women's Dress & Evening Wear";
  }
}

/**
 * Downloads a data URL or image URL as a local file
 */
export function downloadImage(imageUrl: string, filename = "shopsphere-tryon.png") {
  const link = document.createElement("a");
  link.href = imageUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

