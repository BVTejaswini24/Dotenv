"use client";

import CartCounter from "@/components/ui/CartCounter";
import React, { useState } from "react";
import AddToCartBtn from "./AddToCartBtn";
import { Product } from "@/types/product.types";

type AddToCartSectionProps = {
  data: Product;
  selectedSize: string;
  selectedColor: string;
};

const AddToCartSection = ({
  data,
  selectedSize,
  selectedColor,
}: AddToCartSectionProps) => {
  const [quantity, setQuantity] = useState<number>(1);

  const effectivePrice =
    data.discount.percentage > 0
      ? Math.round(data.price - (data.price * data.discount.percentage) / 100)
      : data.discount.amount > 0
        ? data.price - data.discount.amount
        : data.price;

  return (
    <>
      {/* Mobile: fixed bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 px-3.5 pb-safe-bar pt-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-sm md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-black/50">
              Total
            </p>
            <p className="text-base font-bold leading-tight text-black xs:text-lg">
              ${effectivePrice * quantity}
            </p>
          </div>
          <CartCounter
            initialValue={quantity}
            onAdd={setQuantity}
            onRemove={setQuantity}
            max={typeof data.stock === "number" ? data.stock : undefined}
            className="h-12 w-[108px] min-w-[108px] max-w-[108px] shrink-0 px-1.5 py-0"
          />
          <div className="min-w-0 flex-1">
            <AddToCartBtn
              data={{ ...data, quantity }}
              selectedSize={selectedSize}
              selectedColor={selectedColor}
            />
          </div>
        </div>
      </div>

      {/* Desktop: inline */}
      <div className="mt-5 hidden items-center gap-4 md:flex">
        <CartCounter
          initialValue={quantity}
          onAdd={setQuantity}
          onRemove={setQuantity}
          max={typeof data.stock === "number" ? data.stock : undefined}
        />
        <AddToCartBtn
          data={{ ...data, quantity }}
          selectedSize={selectedSize}
          selectedColor={selectedColor}
        />
      </div>
    </>
  );
};

export default AddToCartSection;
