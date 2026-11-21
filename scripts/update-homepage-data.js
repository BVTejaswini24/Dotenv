const fs = require('fs');

// 1. Update src/lib/data/products.ts
let prodCode = fs.readFileSync('src/lib/data/products.ts', 'utf8');

const marker = '// Rich diverse collections for homepage';
const idx = prodCode.indexOf(marker);

if (idx !== -1) {
  const replacement = `// Diverse cross-category collections for homepage
const categoriesOrder = ['t-shirts', 'shirts', 'jeans', 'pants', 'shorts', 'hoodies', 'jackets', 'accessories'];

function pickDiverse(filterFn: (p: Product) => boolean, exclude: Set<number>): Product[] {
  const res: Product[] = [];
  for (const c of categoriesOrder) {
    const cand = products.find((p) => p.category === c && filterFn(p) && !exclude.has(p.id));
    if (cand) {
      res.push(cand);
      exclude.add(cand.id);
    }
  }
  return res;
}

const usedIds = new Set<number>([42]);
export const featuredData: Product[] = pickDiverse((p) => p.isFeatured, usedIds);
export const newArrivalsData: Product[] = pickDiverse((p) => p.isNew, usedIds);
export const topSellingData: Product[] = pickDiverse((p) => p.isBestSeller, usedIds);
export const trendingData: Product[] = pickDiverse((p) => p.rating >= 4.7, usedIds);

// Category-specific spotlights
export const outerwearCollection: Product[] = products
  .filter((p) => p.category === 'jackets' && p.id !== 42)
  .slice(0, 8);

export const accessoriesCollection: Product[] = products
  .filter((p) => p.category === 'accessories' && p.id !== 42)
  .slice(0, 8);

export const relatedProductData: Product[] = products.filter((p) =>
  [12, 13, 14, 15, 43, 65, 82, 110, 125].includes(p.id)
);
`;

  prodCode = prodCode.substring(0, idx) + replacement;
  fs.writeFileSync('src/lib/data/products.ts', prodCode, 'utf8');
  console.log('Successfully updated products.ts collections');
} else {
  console.log('Marker not found in products.ts');
}

// 2. Update src/app/page.tsx
const homePageContent = `import ProductListSec from "@/components/common/ProductListSec";
import Brands from "@/components/homepage/Brands";
import DressStyle from "@/components/homepage/DressStyle";
import Header from "@/components/homepage/Header";
import Reviews from "@/components/homepage/Reviews";
import {
  featuredData,
  newArrivalsData,
  topSellingData,
  trendingData,
  outerwearCollection,
} from "@/lib/data/products";
import { reviewsData } from "@/lib/data/reviews";

export default function Home() {
  return (
    <>
      <Header />
      <Brands />
      <main className="my-[50px] sm:my-[72px] space-y-12 sm:space-y-16">
        {/* Featured Products Collection */}
        <ProductListSec
          title="FEATURED COLLECTION"
          data={featuredData}
          viewAllLink="/shop?sort=recommended"
        />

        <div className="max-w-frame mx-auto px-4 xl:px-0">
          <hr className="h-[1px] border-t-black/10" />
        </div>

        {/* New Arrivals */}
        <ProductListSec
          title="NEW ARRIVALS"
          data={newArrivalsData}
          viewAllLink="/shop?sort=newest"
        />

        <div className="max-w-frame mx-auto px-4 xl:px-0">
          <hr className="h-[1px] border-t-black/10" />
        </div>

        {/* Top Selling */}
        <ProductListSec
          title="TOP SELLING"
          data={topSellingData}
          viewAllLink="/shop?sort=rating-desc"
        />

        <div className="max-w-frame mx-auto px-4 xl:px-0">
          <hr className="h-[1px] border-t-black/10" />
        </div>

        {/* Trending Now */}
        <ProductListSec
          title="TRENDING NOW"
          data={trendingData}
          viewAllLink="/shop"
        />

        {/* Dress Style Showcase */}
        <div className="my-[50px] sm:my-20">
          <DressStyle />
        </div>

        {/* Category-Specific Spotlight: Luxury Outerwear */}
        <ProductListSec
          title="LUXURY OUTERWEAR"
          data={outerwearCollection}
          viewAllLink="/shop?category=jackets"
        />

        <Reviews data={reviewsData} />
      </main>
    </>
  );
}
`;

fs.writeFileSync('src/app/page.tsx', homePageContent, 'utf8');
console.log('Successfully updated src/app/page.tsx');
