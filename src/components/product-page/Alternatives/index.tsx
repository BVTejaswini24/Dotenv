"use client";

import React from "react";
import { Product } from "@/types/product.types";
import { cn } from "@/lib/utils";
import { integralCF } from "@/styles/fonts";
import { AlertTriangle } from "lucide-react";
import AlternativeCard from "./AlternativeCard";

type SmartAlternativesProps = {
  alternatives: Product[];
};

const SmartAlternatives = ({ alternatives }: SmartAlternativesProps) => {
  return (
    <div className="mt-10">
      {/* Out-of-stock banner */}
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-[13px] px-4 py-3 mb-8">
        <AlertTriangle size={18} className="text-amber-600 shrink-0" />
        <p className="text-sm font-medium text-amber-800">
          This product is currently unavailable. Check out similar products below.
        </p>
      </div>

      {alternatives.length === 0 ? (
        <p className="text-center text-black/50 text-sm py-8">
          No similar products found at this time.
        </p>
      ) : (
        <>
          <h2
            className={cn([
              integralCF.className,
              "text-xl sm:text-2xl md:text-[32px] text-black mb-6 capitalize",
            ])}
          >
            Similar Products You May Like
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {alternatives.map((product) => (
              <AlternativeCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default SmartAlternatives;
