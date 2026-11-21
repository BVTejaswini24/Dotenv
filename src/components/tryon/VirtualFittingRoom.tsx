"use client";

import React, { useState, useEffect } from "react";
import { TryOnCategory, TryOnProduct } from "@/types/tryon.types";
import { FEATURED_TRYON_PRODUCTS, getCategoryLabel } from "@/lib/utils/tryon";
import GlassesTryOn from "./GlassesTryOn";
import ClothingTryOn from "./ClothingTryOn";
import { X, Sparkles, Shirt, Eye, Crown } from "lucide-react";

type VirtualFittingRoomProps = {
  isOpen: boolean;
  onClose: () => void;
  initialProduct?: TryOnProduct;
};

export default function VirtualFittingRoom({
  isOpen,
  onClose,
  initialProduct,
}: VirtualFittingRoomProps) {
  // Use initialProduct or default to first featured item
  const [activeProduct, setActiveProduct] = useState<TryOnProduct>(
    initialProduct || FEATURED_TRYON_PRODUCTS[0]
  );

  const [activeCategory, setActiveCategory] = useState<TryOnCategory>(
    initialProduct?.tryOnCategory || "shirt"
  );

  useEffect(() => {
    if (initialProduct) {
      setActiveProduct(initialProduct);
      setActiveCategory(initialProduct.tryOnCategory);
    }
  }, [initialProduct]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle category switch from top tabs
  const handleSelectCategory = (category: TryOnCategory) => {
    setActiveCategory(category);
    // Find first product in this category
    const match = FEATURED_TRYON_PRODUCTS.find(
      (p) => p.tryOnCategory === category
    );
    if (match) {
      setActiveProduct(match);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-0 backdrop-blur-xl animate-in fade-in duration-200 sm:p-4 md:p-6">
      <div className="relative flex h-[100dvh] max-h-[900px] w-full max-w-5xl flex-col overflow-hidden border border-neutral-800 bg-neutral-950 shadow-2xl sm:h-[92dvh] sm:rounded-3xl">
        {/* Main Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 bg-neutral-900/60 px-3 py-3 sm:px-6 sm:py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-200 flex items-center justify-center text-black font-bold shadow-md shadow-amber-500/20">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                ShopSphere Virtual Fitting Room
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/30">
                  AI & AR
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400 hidden sm:block">
                Interactive real-time try-on for Men&apos;s shirts, AR Sunglasses & Women&apos;s evening wear
              </p>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="order-3 flex w-full items-center gap-1 overflow-x-auto rounded-full border border-neutral-800 bg-neutral-900 p-1 sm:order-none sm:w-auto sm:gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectCategory("shirt")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                activeCategory === "shirt"
                  ? "bg-white text-black font-bold shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Shirt size={13} />
              <span className="hidden xs:inline">Men&apos;s Shirt</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectCategory("glasses")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                activeCategory === "glasses"
                  ? "bg-white text-black font-bold shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Eye size={13} />
              <span className="hidden xs:inline">AR Glasses</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectCategory("dress")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                activeCategory === "dress"
                  ? "bg-white text-black font-bold shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Crown size={13} />
              <span className="hidden xs:inline">Women&apos;s Dress</span>
            </button>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            aria-label="Close virtual fitting room"
          >
            <X size={20} />
          </button>
        </div>

        {/* Fitting Room Viewport */}
        <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-3 md:p-4">
          {activeCategory === "glasses" ? (
            <GlassesTryOn
              product={activeProduct}
              availableProducts={FEATURED_TRYON_PRODUCTS}
              onSelectProduct={setActiveProduct}
              onClose={onClose}
            />
          ) : (
            <ClothingTryOn
              product={activeProduct}
              availableProducts={FEATURED_TRYON_PRODUCTS}
              onSelectProduct={setActiveProduct}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

