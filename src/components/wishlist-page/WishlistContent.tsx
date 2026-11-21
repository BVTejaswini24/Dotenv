"use client";

import BreadcrumbWishlist from "@/components/wishlist-page/BreadcrumbWishlist";
import WishlistProductCard from "@/components/wishlist-page/WishlistProductCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { integralCF } from "@/styles/fonts";
import { TbHeartOff } from "react-icons/tb";
import React from "react";
import { useAppSelector } from "@/lib/hooks/redux";
import { selectWishlistItems } from "@/lib/features/wishlist/wishlistSlice";
import { products } from "@/lib/data/products";
import Link from "next/link";

export default function WishlistContent() {
  const wishlistIds = useAppSelector(selectWishlistItems);

  const wishlistProducts = wishlistIds
    .map((id) => products.find((p) => p.id === Number(id)))
    .filter(Boolean) as typeof products;

  return (
    <>
      {wishlistProducts.length > 0 ? (
        <>
          <BreadcrumbWishlist />
          <h2
            className={cn([
              integralCF.className,
              "mb-4 text-[26px] font-bold uppercase leading-none text-black xs:text-[30px] sm:mb-5 md:mb-6 md:text-[40px]",
            ])}
          >
            wishlist
          </h2>
          <p className="text-black/60 mb-6">
            {wishlistProducts.length} {wishlistProducts.length === 1 ? "item" : "items"}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-2 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4">
            {wishlistProducts.map((product) => (
              <WishlistProductCard key={product.id} data={product} />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-24 flex flex-col items-center px-4 text-center text-gray-300">
          <TbHeartOff strokeWidth={1} className="text-6xl" />
          <span className="block mb-2 mt-4 text-black/40">Your wishlist is empty</span>
          <span className="block mb-6 text-black/40 text-sm">
            Save pieces you love and find them here later.
          </span>
          <Button className="rounded-full w-48" asChild>
            <Link href="/shop">Explore Collection</Link>
          </Button>
        </div>
      )}
    </>
  );
}
