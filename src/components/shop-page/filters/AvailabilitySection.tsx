"use client";

import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ShopFilters } from "@/lib/utils/productFilters";

type AvailabilitySectionProps = {
  filters: ShopFilters;
  onUpdate: (overrides: Partial<ShopFilters>) => void;
};

const AvailabilitySection = ({ filters, onUpdate }: AvailabilitySectionProps) => {
  return (
    <Accordion type="single" collapsible defaultValue="filter-availability">
      <AccordionItem value="filter-availability" className="border-none">
        <AccordionTrigger className="text-black font-bold text-xl hover:no-underline p-0 py-0.5">
          Availability
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-0">
          <label className="flex items-center justify-between gap-3 py-2 text-black/60 cursor-pointer select-none">
            <span>In stock only</span>
            <input
              type="checkbox"
              checked={filters.available}
              onChange={(e) => onUpdate({ available: e.target.checked })}
              className="h-4 w-4 accent-black cursor-pointer"
            />
          </label>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default AvailabilitySection;
