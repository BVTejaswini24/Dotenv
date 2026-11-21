"use client";

import React from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { FiSliders } from "react-icons/fi";
import Filters from ".";
import type { ShopFilters } from "@/lib/utils/productFilters";

type MobileFiltersProps = {
  filters: ShopFilters;
  onUpdate: (overrides: Partial<ShopFilters>) => void;
  onClear: () => void;
};

const MobileFilters = ({ filters, onUpdate, onClear }: MobileFiltersProps) => {
  return (
    <>
      <Drawer>
        <DrawerTrigger asChild>
          <button
            type="button"
            aria-label="Open filters"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F0F0F0] text-black transition-colors hover:bg-black/10 md:hidden"
          >
            <FiSliders className="text-base" aria-hidden />
          </button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[92vh] rounded-t-[20px]">
          <DrawerHeader>
            <div className="flex items-center justify-between">
              <span className="font-bold text-black text-xl">Filters</span>
              <DrawerClose asChild>
                <button
                  type="button"
                  aria-label="Close filters"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-black/40 transition-colors hover:bg-black/5 hover:text-black"
                >
                  <FiSliders className="text-xl" aria-hidden />
                </button>
              </DrawerClose>
            </div>
            <DrawerTitle className="hidden">filters</DrawerTitle>
            <DrawerDescription className="hidden">filters</DrawerDescription>
          </DrawerHeader>
          <div className="w-full space-y-5 overflow-y-auto px-4 py-4 md:space-y-6 md:px-6 md:py-5">
            <Filters filters={filters} onUpdate={onUpdate} onClear={onClear} />
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <button
                type="button"
                className="h-12 w-full rounded-full bg-black text-sm font-medium text-white transition-colors hover:bg-black/85"
              >
                Apply Filters
              </button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default MobileFilters;
