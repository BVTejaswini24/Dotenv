"use client";

import { ProductColor } from "@/types/product.types";
import { cn } from "@/lib/utils";
import React from "react";
import { IoMdCheckmark } from "react-icons/io";

type ColorSelectionProps = {
  colors?: ProductColor[];
  selectedColor: string;
  onSelectColor: (color: string) => void;
};

const ColorSelection = ({
  colors,
  selectedColor,
  onSelectColor,
}: ColorSelectionProps) => {
  if (!colors || colors.length === 0) return null;

  return (
    <div className="flex flex-col">
      <span className="text-sm sm:text-base text-black/60 mb-4">
        Select Colors
      </span>
      <div className="flex items-center flex-wrap space-x-3 sm:space-x-4">
        {colors.map((color) => (
          <button
            key={color.id}
            type="button"
            aria-label={`Select color ${color.name}`}
            aria-pressed={selectedColor === color.name}
            className={cn([
              color.code,
              "flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-black sm:h-10 sm:w-10",
            ])}
            onClick={() => onSelectColor(color.name)}
          >
            {selectedColor === color.name && (
              <IoMdCheckmark className="text-base text-white" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ColorSelection;
