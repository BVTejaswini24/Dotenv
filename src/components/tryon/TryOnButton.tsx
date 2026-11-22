"use client";

import React, { useState } from "react";
import { Product } from "@/types/product.types";
import {
  getGlassesOverlay,
  getTryOnCategory,
  getTryOnType,
} from "@/lib/utils/tryon";
import { TryOnProduct } from "@/types/tryon.types";
import VirtualFittingRoom from "./VirtualFittingRoom";
import { Sparkles, Eye, Shirt } from "lucide-react";

type TryOnButtonProps = {
  product: Product;
  className?: string;
};

export default function TryOnButton({ product, className }: TryOnButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const category = getTryOnCategory(product);
  if (!category) return null;

  const tryOnType = getTryOnType(category);

  // Convert Product to TryOnProduct
  const tryOnProduct: TryOnProduct = {
    id: product.id,
    title: product.title,
    category: product.category,
    tryOnCategory: category,
    tryOnType,
    srcUrl: product.srcUrl,
    price: product.price,
    brand: product.brand || "LUXE",
    gender: product.gender,
    overlayUrl:
      category === "glasses"
        ? getGlassesOverlay({
            id: product.id,
            title: product.title,
          })
        : undefined,
  };

  const isGlasses = category === "glasses";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full group relative flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 text-white font-semibold text-sm sm:text-base border border-amber-400/50 hover:border-amber-300 shadow-[0_4px_20px_rgba(251,191,36,0.15)] hover:shadow-[0_6px_25px_rgba(251,191,36,0.3)] transition-all duration-300 active:scale-[0.99] ${
          className || ""
        }`}
      >
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {isGlasses ? (
          <Eye size={18} className="text-amber-400 group-hover:scale-110 transition-transform" />
        ) : (
          <Sparkles size={18} className="text-amber-400 group-hover:rotate-12 transition-transform" />
        )}

        <span className="tracking-wide">
          {isGlasses ? "Live AR Try-On" : "AI Virtual Try-On"}
        </span>

        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
          {isGlasses ? "Face Tracking" : "AI Mirror"}
        </span>
      </button>

      {isOpen && (
        <VirtualFittingRoom
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          initialProduct={tryOnProduct}
        />
      )}
    </>
  );
}
