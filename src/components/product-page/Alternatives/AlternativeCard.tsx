"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Product } from "@/types/product.types";
import { cn } from "@/lib/utils";
import Rating from "@/components/ui/Rating";
import { useAppDispatch } from "@/lib/hooks/redux";
import { addToCart } from "@/lib/features/carts/cartsSlice";
import { toast } from "sonner";

type AlternativeCardProps = {
  product: Product;
};

const AlternativeCard = ({ product }: AlternativeCardProps) => {
  const dispatch = useAppDispatch();

  const effectivePrice =
    product.discount.percentage > 0
      ? Math.round(
          product.price - (product.price * product.discount.percentage) / 100
        )
      : product.discount.amount > 0
        ? product.price - product.discount.amount
        : product.price;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (typeof product.stock === "number" && product.stock <= 0) {
      toast.error("This product is out of stock.");
      return;
    }

    const defaultSize = product.sizes?.[0]?.name ?? "";
    const defaultColor = product.colors?.[0]?.name ?? "";

    dispatch(
      addToCart({
        id: product.id,
        productId: product.id,
        name: product.title,
        srcUrl: product.srcUrl,
        price: product.price,
        attributes: [defaultSize, defaultColor],
        size: defaultSize,
        color: defaultColor,
        discount: product.discount,
        quantity: 1,
        stock: product.stock,
      })
    );
    toast.success(`${product.title} added to cart!`);
  };

  const isInStock =
    product.stock === undefined || product.stock > 5;
  const isLowStock =
    typeof product.stock === "number" &&
    product.stock > 0 &&
    product.stock <= 5;

  return (
    <div className="bg-white rounded-[20px] border border-black/10 overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
      {/* Image */}
      <Link
        href={`/shop/product/${product.id}/${product.slug}`}
        className="block relative aspect-square bg-[#F0EEED] overflow-hidden"
      >
        <Image
          src={product.srcUrl}
          alt={product.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {/* Stock badge */}
        <span
          className={cn(
            "absolute top-2.5 left-2.5 text-[10px] font-medium px-2 py-0.5 rounded-full",
            isInStock
              ? "bg-green-50 text-green-700"
              : isLowStock
                ? "bg-amber-50 text-amber-700"
                : "bg-red-50 text-red-700"
          )}
        >
          {isInStock
            ? "In Stock"
            : isLowStock
              ? `Only ${product.stock} left`
              : "Out of Stock"}
        </span>
        {/* Discount badge */}
        {product.discount.percentage > 0 && (
          <span className="absolute top-2.5 right-2.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FF3333]/10 text-[#FF3333]">
            -{product.discount.percentage}%
          </span>
        )}
      </Link>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-2">
        <div>
          <strong className="text-sm font-bold text-black line-clamp-2 leading-snug">
            {product.title}
          </strong>
          <p className="text-xs text-black/50 mt-0.5">{product.brand}</p>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1">
          <Rating
            initialValue={product.rating}
            allowFraction
            SVGclassName="inline-block"
            emptyClassName="fill-gray-50"
            size={12}
            readonly
          />
          <span className="text-[10px] text-black/60">
            {product.rating.toFixed(1)}/5
          </span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-black text-base">
            ${effectivePrice}
          </span>
          {product.discount.percentage > 0 && (
            <span className="font-medium text-black/40 line-through text-sm">
              ${product.price}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-auto pt-1">
          <Link
            href={`/shop/product/${product.id}/${product.slug}`}
            className="w-full text-center text-xs sm:text-sm font-medium border border-black/20 rounded-full py-2 px-3 hover:bg-black hover:text-white hover:border-black transition-all"
          >
            View Product
          </Link>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={typeof product.stock === "number" && product.stock <= 0}
            className={cn(
              "w-full text-xs sm:text-sm font-medium rounded-full py-2 px-3 flex items-center justify-center gap-1.5 transition-all",
              typeof product.stock === "number" && product.stock <= 0
                ? "bg-black/10 text-black/40 cursor-not-allowed"
                : "bg-black text-white hover:bg-black/80"
            )}
          >
            <ShoppingCart size={13} />
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlternativeCard;
