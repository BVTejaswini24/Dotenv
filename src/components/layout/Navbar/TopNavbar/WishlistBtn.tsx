"use client";

import { useAppSelector } from "@/lib/hooks/redux";
import { selectWishlistCount } from "@/lib/features/wishlist/wishlistSlice";
import { Heart } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const WishlistBtn = () => {
  const count = useAppSelector(selectWishlistCount);

  return (
    <Link
      href="/wishlist"
      aria-label={`Wishlist${count > 0 ? `, ${count} items` : ""}`}
      className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5 transition-colors"
    >
      <Heart
        size={20}
        className={cn("text-black", count > 0 && "fill-black")}
      />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-black text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5 text-[10px] font-bold leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
};

export default WishlistBtn;
