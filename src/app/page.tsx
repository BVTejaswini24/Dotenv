import ProductListSec from "@/components/common/ProductListSec";
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
      <main className="mt-9 space-y-10 pb-2 sm:my-[72px] sm:space-y-16">
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
        <div className="my-10 sm:my-20">
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
