"use client";

import { useAppSelector } from "@/lib/hooks/redux";
import { RootState } from "@/lib/store";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import React from "react";

const CartBtn = () => {
  const { cart } = useAppSelector((state: RootState) => state.carts);

  return (
    <Link
      href="/cart"
      aria-label={`Cart${cart && cart.totalQuantities > 0 ? `, ${cart.totalQuantities} items` : ""}`}
      className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5 transition-colors"
    >
      <ShoppingCart size={20} className="text-black" />
      {cart && cart.totalQuantities > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-black text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5 text-[10px] font-bold leading-none">
          {cart.totalQuantities > 99 ? "99+" : cart.totalQuantities}
        </span>
      )}
    </Link>
  );
};

export default CartBtn;
