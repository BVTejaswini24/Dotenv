"use client";

import React from "react";
import { PiTrashFill } from "react-icons/pi";
import Image from "next/image";
import Link from "next/link";
import CartCounter from "@/components/ui/CartCounter";
import {
  addToCart,
  CartItem,
  remove,
  removeCartItem,
} from "@/lib/features/carts/cartsSlice";
import { useAppDispatch } from "@/lib/hooks/redux";
import { products } from "@/lib/data/products";

type ProductCardProps = {
  data: CartItem;
};

const ProductCard = ({ data }: ProductCardProps) => {
  const dispatch = useAppDispatch();
  const productData = products.find((p) => p.id === data.id);
  const stock = productData?.stock;
  const isLowStock = typeof stock === "number" && stock > 0 && stock <= 5;

  const effectivePrice =
    data.discount.percentage > 0
      ? Math.round(data.price - (data.price * data.discount.percentage) / 100)
      : data.discount.amount > 0
        ? data.price - data.discount.amount
        : data.price;

  const hasDiscount = data.discount.percentage > 0 || data.discount.amount > 0;
  const productHref = `/shop/product/${data.id}/${data.name
    .toLowerCase()
    .replace(/\s+/g, "-")}`;

  const handleRemove = () =>
    dispatch(
      remove({
        id: data.id,
        attributes: data.attributes,
        quantity: data.quantity,
      })
    );

  return (
    <div className="flex items-start gap-3 sm:gap-4">
      {/* Product image */}
      <Link
        href={productHref}
        className="relative h-[92px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-[#F0EEED] xs:h-24 xs:w-24 sm:rounded-2xl md:h-[124px] md:w-[124px]"
        aria-label={data.name}
      >
        <Image
          src={data.srcUrl}
          width={124}
          height={124}
          sizes="(max-width: 639px) 92px, 124px"
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          alt={data.name}
          priority
        />
      </Link>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col self-stretch">
        {/* Name + delete */}
        <div className="flex items-start gap-1.5">
          <Link
            href={productHref}
            className="line-clamp-2 min-w-0 flex-1 text-[13px] font-semibold leading-snug text-black xs:text-sm sm:text-base"
          >
            {data.name}
          </Link>
          <button
            type="button"
            className="-mr-1.5 -mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 active:bg-red-100"
            onClick={handleRemove}
            aria-label={`Remove ${data.name} from cart`}
          >
            <PiTrashFill className="text-base" aria-hidden />
          </button>
        </div>

        {/* Attributes */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {data.attributes[0] && data.attributes[0] !== "Default" && (
            <span className="rounded-full bg-[#F0F0F0] px-2 py-0.5 text-[11px] text-black/60">
              Size <span className="font-medium text-black/80">{data.attributes[0]}</span>
            </span>
          )}
          {data.attributes[1] && data.attributes[1] !== "Default" && (
            <span className="rounded-full bg-[#F0F0F0] px-2 py-0.5 text-[11px] text-black/60">
              Color <span className="font-medium text-black/80">{data.attributes[1]}</span>
            </span>
          )}
        </div>

        {/* Price + counter */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-sm font-bold text-black xs:text-base sm:text-lg">
                ${effectivePrice}
              </span>
              {hasDiscount && (
                <span className="text-xs font-medium text-black/40 line-through">
                  ${data.price}
                </span>
              )}
            </div>
            {isLowStock && (
              <p className="mt-0.5 text-[10px] font-medium text-amber-600">
                Only {stock} left
              </p>
            )}
          </div>

          <CartCounter
            initialValue={data.quantity}
            max={typeof stock === "number" ? stock : undefined}
            onAdd={() => dispatch(addToCart({ ...data, quantity: 1, stock }))}
            onRemove={() =>
              data.quantity === 1
                ? handleRemove()
                : dispatch(
                    removeCartItem({ id: data.id, attributes: data.attributes })
                  )
            }
            isZeroDelete
            className="h-10 w-[112px] min-w-[112px] max-w-[112px] shrink-0 px-1.5 py-0 md:px-2.5"
          />
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
