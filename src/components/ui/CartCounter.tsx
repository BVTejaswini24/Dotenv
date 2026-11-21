"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FaMinus, FaPlus } from "react-icons/fa6";
import { cn } from "@/lib/utils";

type CartCounterProps = {
  isZeroDelete?: boolean;
  onAdd?: (value: number) => void;
  onRemove?: (value: number) => void;
  className?: string;
  initialValue?: number;
  max?: number;
};

const CartCounter = ({
  isZeroDelete,
  onAdd,
  onRemove,
  className,
  initialValue = 1,
  max,
}: CartCounterProps) => {
  const [counter, setCounter] = useState<number>(initialValue);

  const addToCart = () => {
    if (max !== undefined && counter >= max) return;
    if (onAdd) {
      onAdd(counter + 1);
    }
    setCounter(counter + 1);
  };

  const remove = () => {
    if ((counter === 1 && !isZeroDelete) || counter <= 0) return;

    if (onRemove) {
      onRemove(counter - 1);
    }
    if (counter - 1 <= 0) return;
    setCounter(counter - 1);
  };

  const atMax = max !== undefined && counter >= max;
  const atMin = counter <= 1 && !isZeroDelete;

  return (
    <div
      className={cn(
        "flex w-full min-w-[104px] max-w-[170px] items-center justify-between gap-1 rounded-full bg-[#F0F0F0] px-2.5 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-3",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        type="button"
        disabled={atMin}
        className="h-9 w-9 shrink-0 rounded-full text-[11px] hover:bg-black/5 disabled:opacity-40 sm:text-xs"
        onClick={() => remove()}
        aria-label="Decrease quantity"
      >
        <FaMinus />
      </Button>
      <span
        className="min-w-[1.25rem] text-center text-sm font-medium tabular-nums sm:text-base"
        aria-live="polite"
      >
        {counter}
      </span>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        disabled={atMax}
        className={cn(
          "h-9 w-9 shrink-0 rounded-full text-[11px] hover:bg-black/5 sm:text-xs",
          atMax && "cursor-not-allowed opacity-30"
        )}
        onClick={() => addToCart()}
        aria-label="Increase quantity"
      >
        <FaPlus />
      </Button>
    </div>
  );
};

export default CartCounter;
