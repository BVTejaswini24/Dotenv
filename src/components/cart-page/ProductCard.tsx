"use client";

import React from "react";
import { PiTrashFill } from "react-icons/pi";
import Image from "next/image";
import Link from "next/link";
import CartCounter from "@/components/ui/CartCounter";
import { Button } from "../ui/button";
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

  return (
    <div className="flex items-start gap-3 sm:gap-4">
      {/* Product image */}
      <Link
        href={`/shop/product/${data.id}/${data.name.toLowerCase().replace(/\s+/g, "-")}`}
        className="bg-[#F0EEED] rounded-lg shrink-0 w-20 h-20 sm:w-24 sm:h-24 md:w-[124px] md:h-[124px] overflow-hidden"
        aria-label={data.name}
      >
        <Image
          src={data.srcUrl}
          width={124}
          height={124}
          className="w-full h-full object-cover hover:scale-110 transition-all duration-500"
          alt={data.name}
          priority
        />
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col self-stretch">
        {/* Name + delete */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <Link
            href={`/shop/product/${data.id}/${data.name.toLowerCase().replace(/\s+/g, "-")}`}
            className="text-black font-bold text-sm sm:text-base leading-snug line-clamp-2"
          >
            {data.name}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 w-8 h-8 p-0 hover:bg-red-50"
            onClick={() =>
              dispatch(
                remove({
                  id: data.id,
                  attributes: data.attributes,
                  quantity: data.quantity,
                })
              )
            }
            aria-label={`Remove ${data.name} from cart`}
          >
            <PiTrashFill className="text-lg text-red-500" />
          </Button>
        </div>

        {/* Attributes */}
        <div className="flex flex-wrap gap-x-3 mb-1">
          {data.attributes[0] && data.attributes[0] !== "Default" && (
            <span className="text-black/50 text-xs">
              Size: <span className="text-black/70">{data.attributes[0]}</span>
            </span>
          )}
          {data.attributes[1] && data.attributes[1] !== "Default" && (
            <span className="text-black/50 text-xs">
              Color: <span className="text-black/70">{data.attributes[1]}</span>
            </span>
          )}
        </div>

        {/* Price + counter */}
        <div className="flex items-center justify-between flex-wrap gap-2 mt-auto">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-black text-base sm:text-lg">
              ${effectivePrice}
            </span>
            {(data.discount.percentage > 0 || data.discount.amount > 0) && (
              <span className="font-medium text-black/40 line-through text-sm">
                ${data.price}
              </span>
            )}
            {data.discount.percentage > 0 && (
              <span className="text-[10px] font-medium py-0.5 px-2 rounded-full bg-[#FF3333]/10 text-[#FF3333]">
                -{data.discount.percentage}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isLowStock && (
              <span className="text-[10px] text-amber-600 font-medium whitespace-nowrap hidden sm:inline">
                Only {stock} left
              </span>
            )}
            <CartCounter
              initialValue={data.quantity}
              max={typeof stock === "number" ? stock : undefined}
              onAdd={() => dispatch(addToCart({ ...data, quantity: 1, stock }))}
              onRemove={() =>
                data.quantity === 1
                  ? dispatch(
                      remove({
                        id: data.id,
                        attributes: data.attributes,
                        quantity: data.quantity,
                      })
                    )
                  : dispatch(
                      removeCartItem({ id: data.id, attributes: data.attributes })
                    )
              }
              isZeroDelete
              className="px-3 sm:px-5 py-2 max-h-9 min-w-[90px] max-w-[110px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
