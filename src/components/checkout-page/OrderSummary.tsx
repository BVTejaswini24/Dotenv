"use client";

import React from "react";
import Image from "next/image";
import { CartItem } from "@/lib/features/carts/cartsSlice";
import { DeliveryMethod } from "./checkout.types";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/lib/hooks/redux";
import {
  selectSignupApplied,
  selectPromoCode,
  selectPromoDiscountPercent,
} from "@/lib/features/discount/discountSlice";
import { Tag } from "lucide-react";
import { calculateOrderTotal } from "@/lib/utils/pricing";

type OrderSummaryProps = {
  items: CartItem[];
  subtotal: number;
  adjustedTotal: number;
  delivery: DeliveryMethod;
};

const OrderSummary = ({
  items,
  subtotal,
  adjustedTotal,
  delivery,
}: OrderSummaryProps) => {
  const signupApplied = useAppSelector(selectSignupApplied);
  const promoCode = useAppSelector(selectPromoCode);
  const promoDiscountPercent = useAppSelector(selectPromoDiscountPercent);

  const { signupDiscount, promoDiscount, deliveryFee, total } =
    calculateOrderTotal({
      adjustedTotal,
      signupApplied,
      promoCode,
      promoDiscountPercent,
      delivery,
    });

  const productDiscount = Math.round(subtotal - adjustedTotal);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-4 rounded-2xl border border-black/10 bg-white p-4 xs:p-5 sm:rounded-[20px] md:p-6 lg:sticky lg:top-24">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-black sm:text-xl">Order Summary</h2>
        <span className="shrink-0 text-xs text-black/50">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="space-y-3.5 md:max-h-[320px] md:overflow-y-auto md:pr-2">
        {items.map((item) => {
          const effectivePrice =
            item.discount.percentage > 0
              ? Math.round(
                  item.price - (item.price * item.discount.percentage) / 100
                )
              : item.discount.amount > 0
                ? item.price - item.discount.amount
                : item.price;

          const variants = item.attributes
            .filter((attr) => attr && attr !== "Default")
            .join(" / ");

          return (
            <div
              key={`${item.id}-${item.attributes.join("-")}`}
              className="flex gap-3"
            >
              <div className="relative h-16 w-16 min-w-[64px] overflow-hidden rounded-lg bg-[#F0EEED]">
                <Image
                  src={item.srcUrl}
                  width={64}
                  height={64}
                  sizes="64px"
                  className="h-full w-full object-cover"
                  alt={item.name}
                />
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-black px-1 text-[10px] font-bold leading-none text-white">
                  {item.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13px] font-medium leading-snug text-black sm:text-sm">
                  {item.name}
                </p>
                {variants && (
                  <p className="mt-0.5 text-[11px] text-black/60">{variants}</p>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-bold text-black">
                    ${effectivePrice * item.quantity}
                  </span>
                  {(item.discount.percentage > 0 || item.discount.amount > 0) && (
                    <span className="text-xs text-black/40 line-through">
                      ${item.price * item.quantity}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 border-t border-black/10 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-black/60">Subtotal</span>
          <span className="text-sm font-bold text-black">${subtotal}</span>
        </div>

        {productDiscount > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-black/60">Product Discount</span>
            <span className="text-sm font-bold text-red-600">
              -${productDiscount}
            </span>
          </div>
        )}

        {signupApplied && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1 text-sm text-black/60">
              <Tag size={12} className="shrink-0" />
              <span className="truncate">20% Sign-up Discount</span>
            </span>
            <span className="text-sm font-bold text-red-600">
              -${signupDiscount}
            </span>
          </div>
        )}

        {promoCode && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1 text-sm text-black/60">
              <Tag size={12} className="shrink-0" />
              <span className="truncate">Promo Code ({promoCode})</span>
            </span>
            <span className="text-sm font-bold text-red-600">
              -${promoDiscount}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-black/60">Shipping</span>
          <span
            className={cn(
              "text-sm font-bold",
              deliveryFee === 0 ? "text-green-600" : "text-black"
            )}
          >
            {deliveryFee === 0 ? "Free" : `$${deliveryFee}`}
          </span>
        </div>

        <div className="border-t border-black/10 pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-base font-bold text-black">Total</span>
            <span className="text-xl font-bold text-black">${total}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;
