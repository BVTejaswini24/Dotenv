"use client";

import React from "react";
import Rating from "../ui/Rating";
import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types/product.types";
import { Heart } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks/redux";
import { toggleWishlist, selectIsInWishlist } from "@/lib/features/wishlist/wishlistSlice";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProductCardProps = {
  data: Product;
};

const ProductCard = ({ data }: ProductCardProps) => {
  const dispatch = useAppDispatch();
  const isInWishlist = useAppSelector(selectIsInWishlist(String(data.id)));

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(toggleWishlist(String(data.id)));
    toast(isInWishlist ? "Removed from wishlist" : "Added to wishlist");
  };

  return (
    <Link
      href={`/shop/product/${data.id}/${data.slug}`}
      className="group flex h-full min-w-0 flex-col items-stretch"
    >
      <div className="relative mb-2.5 aspect-square w-full overflow-hidden rounded-xl bg-[#F0EEED] sm:mb-3 sm:rounded-2xl lg:mb-3.5 lg:rounded-[20px]">
        <Image
          src={data.srcUrl}
          width={295}
          height={298}
          sizes="(max-width: 639px) 45vw, (max-width: 1023px) 30vw, 295px"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          alt={data.title}
          loading="lazy"
        />
        <button
          type="button"
          onClick={handleWishlistToggle}
          aria-label={isInWishlist ? `Remove ${data.title} from wishlist` : `Add ${data.title} to wishlist`}
          className={cn(
            "absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm transition-all hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:right-2.5 sm:top-2.5",
            isInWishlist ? "text-red-500" : "text-black/40 hover:text-black/60"
          )}
        >
          <Heart
            size={17}
            className={cn("sm:h-5 sm:w-5", isInWishlist && "fill-red-500")}
          />
        </button>
      </div>

      <strong className="line-clamp-2 min-h-[2.5em] text-[13px] leading-snug text-black xs:text-sm sm:text-base xl:text-xl">
        {data.title}
      </strong>

      <div className="mt-1 flex items-center gap-1.5">
        <Rating
          initialValue={data.rating}
          allowFraction
          SVGclassName="inline-block"
          emptyClassName="fill-gray-50"
          size={14}
          readonly
        />
        <span className="text-[11px] text-black sm:text-xs xl:text-sm">
          {data.rating.toFixed(1)}
          <span className="text-black/60">/5</span>
        </span>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1.5">
        {data.discount.percentage > 0 ? (
          <span className="text-base font-bold text-black sm:text-xl xl:text-2xl">
            {`$${Math.round(
              data.price - (data.price * data.discount.percentage) / 100
            )}`}
          </span>
        ) : data.discount.amount > 0 ? (
          <span className="text-base font-bold text-black sm:text-xl xl:text-2xl">
            {`$${data.price - data.discount.amount}`}
          </span>
        ) : (
          <span className="text-base font-bold text-black sm:text-xl xl:text-2xl">
            ${data.price}
          </span>
        )}
        {(data.discount.percentage > 0 || data.discount.amount > 0) && (
          <span className="text-[13px] font-bold text-black/40 line-through sm:text-xl xl:text-2xl">
            ${data.price}
          </span>
        )}
        {data.discount.percentage > 0 ? (
          <span className="rounded-full bg-[#FF3333]/10 px-2 py-0.5 text-[10px] font-medium text-[#FF3333] sm:px-3.5 sm:py-1.5 sm:text-xs xl:text-xs">
            {`-${data.discount.percentage}%`}
          </span>
        ) : (
          data.discount.amount > 0 && (
            <span className="rounded-full bg-[#FF3333]/10 px-2 py-0.5 text-[10px] font-medium text-[#FF3333] sm:px-3.5 sm:py-1.5 sm:text-xs xl:text-xs">
              {`-$${data.discount.amount}`}
            </span>
          )
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
