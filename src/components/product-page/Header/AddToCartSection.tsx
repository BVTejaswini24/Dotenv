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

  return (
    <>
      {/* Mobile: fixed bottom bar */}
      <div className="fixed md:hidden bottom-0 left-0 right-0 bg-white border-t border-black/10 shadow-lg z-30 px-4 py-3 flex items-center gap-3">
        <CartCounter
          onAdd={setQuantity}
          onRemove={setQuantity}
          max={typeof data.stock === "number" ? data.stock : undefined}
          className="shrink-0"
        />
        <div className="flex-1">
          <AddToCartBtn
            data={{ ...data, quantity }}
            selectedSize={selectedSize}
            selectedColor={selectedColor}
          />
        </div>
      </div>

      {/* Desktop: inline */}
      <div className="hidden md:flex items-center gap-4 mt-5">
        <CartCounter
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
