"use client";

import BreadcrumbCart from "@/components/cart-page/BreadcrumbCart";
import ProductCard from "@/components/cart-page/ProductCard";
import { Button } from "@/components/ui/button";
import InputGroup from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { integralCF } from "@/styles/fonts";
import { FaArrowRight, FaX } from "react-icons/fa6";
import { MdOutlineLocalOffer } from "react-icons/md";
import { TbBasketExclamation } from "react-icons/tb";
import { ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { RootState } from "@/lib/store";
import { useAppSelector, useAppDispatch } from "@/lib/hooks/redux";
import Link from "next/link";
import { toast } from "sonner";
import {
  applyPromoCode,
  removePromoCode,
  selectPromoCode,
  selectPromoDiscountPercent,
  isValidPromoCode,
} from "@/lib/features/discount/discountSlice";

export default function CartContent() {
  const dispatch = useAppDispatch();
  const { cart, totalPrice, adjustedTotalPrice } = useAppSelector(
    (state: RootState) => state.carts
  );
  const promoCode = useAppSelector(selectPromoCode);
  const promoDiscountPercent = useAppSelector(selectPromoDiscountPercent);

  const [promoInput, setPromoInput] = useState("");

  const promoDiscountAmount = promoCode
    ? Math.round((adjustedTotalPrice * promoDiscountPercent) / 100)
    : 0;
  const finalTotal = Math.round(adjustedTotalPrice - promoDiscountAmount);
  const itemCount = cart?.totalQuantities ?? 0;

  const handleApplyPromo = () => {
    const code = promoInput.trim();
    if (!code) {
      toast.error("Please enter a promo code.");
      return;
    }
    if (promoCode) {
      toast.error("A promo code is already applied. Remove it first.");
      return;
    }
    if (!isValidPromoCode(code)) {
      toast.error("Invalid promo code. Please try again.");
      return;
    }
    dispatch(applyPromoCode(code));
    setPromoInput("");
    toast.success("Promo code applied successfully!");
  };

  const handleRemovePromo = () => {
    dispatch(removePromoCode());
    toast("Promo code removed.");
  };

  return (
    <>
      {cart && cart.items.length > 0 ? (
        <>
          <BreadcrumbCart />
          <h1
            className={cn([
              integralCF.className,
              "mb-4 text-[26px] font-bold uppercase leading-none text-black xs:text-[30px] sm:mb-5 md:mb-6 md:text-[40px]",
            ])}
          >
            your cart
          </h1>
          <div className="flex flex-col items-start gap-5 lg:flex-row">
            {/* Items */}
            <div className="w-full overflow-hidden rounded-2xl border border-black/10 p-3.5 xs:p-4 sm:rounded-[20px] md:px-6">
              <div className="divide-y divide-black/10">
                {cart.items.map((product) => (
                  <div
                    key={`${product.id}-${product.attributes.join("-")}`}
                    className="py-3.5 first:pt-0 last:pb-0"
                  >
                    <ProductCard data={product} />
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="w-full rounded-2xl border border-black/10 p-4 xs:p-5 sm:rounded-[20px] md:px-6 lg:max-w-[505px] lg:min-w-[400px]">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-bold text-black xs:text-xl md:text-2xl">
                  Order Summary
                </h2>
                <span className="shrink-0 text-xs text-black/50">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </div>

              <div className="flex flex-col gap-3.5 xs:gap-4 md:gap-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-black/60 md:text-xl">Subtotal</span>
                  <span className="text-sm font-bold text-black md:text-xl">
                    ${totalPrice}
                  </span>
                </div>
                {totalPrice > adjustedTotalPrice && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-black/60 md:text-xl">
                      Discount (-
                      {totalPrice > 0
                        ? Math.round(
                            ((totalPrice - adjustedTotalPrice) / totalPrice) * 100
                          )
                        : 0}
                      %)
                    </span>
                    <span className="text-sm font-bold text-red-600 md:text-xl">
                      -${Math.round(totalPrice - adjustedTotalPrice)}
                    </span>
                  </div>
                )}
                {promoCode && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-black/60 md:text-xl">
                      Promo ({promoCode} -{promoDiscountPercent}%)
                    </span>
                    <span className="text-sm font-bold text-red-600 md:text-xl">
                      -${promoDiscountAmount}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-black/60 md:text-xl">Shipping</span>
                  <span className="text-sm font-bold text-green-600 md:text-xl">
                    Free
                  </span>
                </div>
                <hr className="border-t-black/10" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base text-black md:text-xl">Total</span>
                  <span className="text-lg font-bold text-black md:text-2xl">
                    ${finalTotal}
                  </span>
                </div>
              </div>

              <div className="mt-4 md:mt-6">
                {promoCode ? (
                  <div className="flex items-center justify-between gap-3 rounded-full bg-[#F0F0F0] px-4 py-3">
                    <span className="min-w-0 truncate text-sm font-medium text-black">
                      {promoCode} applied ({promoDiscountPercent}% off)
                    </span>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black/40 transition-colors hover:bg-black/5 hover:text-black"
                      aria-label="Remove promo code"
                    >
                      <FaX className="text-sm" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 xs:flex-row xs:items-center">
                    <InputGroup className="h-12 bg-[#F0F0F0]">
                      <InputGroup.Text>
                        <MdOutlineLocalOffer className="text-2xl text-black/40" aria-hidden />
                      </InputGroup.Text>
                      <InputGroup.Input
                        type="text"
                        name="code"
                        placeholder="Add promo code"
                        className="bg-transparent placeholder:text-black/40"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleApplyPromo();
                        }}
                        aria-label="Promo code"
                      />
                    </InputGroup>
                    <Button
                      type="button"
                      className="h-12 w-full shrink-0 rounded-full bg-black text-sm xs:w-auto xs:px-6"
                      onClick={handleApplyPromo}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>

              <Button
                type="button"
                className="mt-4 h-[56px] w-full rounded-full bg-black text-sm font-medium text-white transition-colors hover:bg-black/85 md:mt-6 md:h-[60px] md:text-base"
                asChild
              >
                <Link href="/checkout" className="group flex items-center justify-center">
                  Go to Checkout
                  <FaArrowRight
                    className="ml-2 text-lg transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </Link>
              </Button>

              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-black/40">
                <ShieldCheck size={14} aria-hidden />
                Secure checkout · Free 30-day returns
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-24 flex flex-col items-center px-4 text-center text-gray-300">
          <TbBasketExclamation strokeWidth={1} className="text-6xl" />
          <h1 className="mt-4 text-lg font-bold text-black">
            Your shopping cart is empty
          </h1>
          <p className="mb-6 mt-1 max-w-xs text-sm text-black/50">
            Discover new arrivals and add your favourite pieces to get started.
          </p>
          <Button className="h-12 w-48 rounded-full" asChild>
            <Link href="/shop">Continue Shopping</Link>
          </Button>
        </div>
      )}
    </>
  );
}
