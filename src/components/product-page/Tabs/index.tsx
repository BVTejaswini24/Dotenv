"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import React, { useState } from "react";
import ProductDetailsContent from "./ProductDetailsContent";
import ReviewsContent from "./ReviewsContent";
import FaqContent from "./FaqContent";
import { Product } from "@/types/product.types";

type TabBtn = {
  id: number;
  label: string;
};

const tabBtnData: TabBtn[] = [
  {
    id: 1,
    label: "Product Details",
  },
  {
    id: 2,
    label: "Rating & Reviews",
  },
  {
    id: 3,
    label: "FAQs",
  },
];

type TabsProps = {
  product?: Product;
};

const Tabs = ({ product }: TabsProps) => {
  const [active, setActive] = useState<number>(1);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Product information"
        className="mb-5 flex items-stretch overflow-x-auto border-b border-black/10 scrollbar-none sm:mb-8"
      >
        {tabBtnData.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls="product-tab-panel"
            id={`product-tab-${tab.id}`}
            className={cn([
              active === tab.id
                ? "border-black border-b-2 font-medium"
                : "border-b border-transparent text-black/60 font-normal",
              "flex-1 flex-shrink-0 whitespace-nowrap rounded-none px-2.5 py-3 text-xs sm:px-6 sm:py-5 sm:text-sm md:text-base",
            ])}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <div
        id="product-tab-panel"
        role="tabpanel"
        aria-labelledby={`product-tab-${active}`}
        className="mb-12 sm:mb-16"
      >
        {active === 1 && <ProductDetailsContent product={product} />}
        {active === 2 && <ReviewsContent product={product} />}
        {active === 3 && <FaqContent />}
      </div>
    </div>
  );
};

export default Tabs;
