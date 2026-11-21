"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bell, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/lib/hooks/redux";
import { selectCurrentUser, selectIsAuthenticated } from "@/lib/features/auth/authSlice";
import {
  addToWatchlist,
  updateTargetPrice,
  selectIsWatching,
  selectWatchlistEntry,
} from "@/lib/features/watchlist/watchlistSlice";
import { Product } from "@/types/product.types";

type TrackPriceButtonProps = {
  product: Product;
};

const TrackPriceButton = ({ product }: TrackPriceButtonProps) => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectCurrentUser);

  const userId = user?.id ?? "";
  const isWatching = useAppSelector(selectIsWatching(product.id, userId));
  const existingEntry = useAppSelector(selectWatchlistEntry(product.id, userId));

  const effectivePrice =
    product.discount.percentage > 0
      ? Math.round(product.price - (product.price * product.discount.percentage) / 100)
      : product.discount.amount > 0
        ? product.price - product.discount.amount
        : product.price;

  const [open, setOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState<string>(
    existingEntry ? String(existingEntry.targetPrice) : String(Math.max(1, effectivePrice - 5))
  );
  const [error, setError] = useState<string>("");

  const handleButtonClick = () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to track prices");
      return;
    }
    setTargetPrice(
      existingEntry ? String(existingEntry.targetPrice) : String(Math.max(1, effectivePrice - 5))
    );
    setError("");
    setOpen(true);
  };

  const handleSubmit = () => {
    const price = parseFloat(targetPrice);
    if (!targetPrice || isNaN(price) || price <= 0) {
      setError("Please enter a valid target price greater than 0.");
      return;
    }

    if (existingEntry) {
      dispatch(
        updateTargetPrice({
          id: existingEntry.id,
          targetPrice: price,
          currentPrice: effectivePrice,
        })
      );
    } else {
      dispatch(
        addToWatchlist({
          userId,
          productId: product.id,
          productTitle: product.title,
          productSrcUrl: product.srcUrl,
          productCategory: product.category,
          currentPrice: effectivePrice,
          originalPrice: product.price,
          discountPercentage: product.discount.percentage,
          targetPrice: price,
          status: "watching",
        })
      );
    }

    toast.success(`You'll be notified when price drops to $${price.toFixed(0)}`);
    setOpen(false);
  };

  const isPriceDropped =
    existingEntry?.status === "reached" || existingEntry?.status === "notified";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          onClick={handleButtonClick}
          className={cn(
            "w-full md:w-auto border rounded-full h-11 px-6 text-sm font-medium flex items-center gap-2 transition-all",
            isPriceDropped
              ? "border-green-500 text-green-700 hover:bg-green-50"
              : isWatching
                ? "border-black bg-black text-white hover:bg-black/80"
                : "border-black text-black hover:bg-black hover:text-white"
          )}
        >
          {isPriceDropped ? (
            <>
              <Check size={16} />
              🎉 Price Dropped!
            </>
          ) : isWatching ? (
            <>
              <Bell size={16} className="fill-white" />
              Tracking Price
            </>
          ) : (
            <>
              <Bell size={16} />
              Track Price
            </>
          )}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] bg-white rounded-[20px] border border-black/10 p-6 w-full max-w-sm shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-bold text-black">
              {existingEntry ? "Update Price Target" : "Track Price"}
            </Dialog.Title>
            <Dialog.Close className="p-1 rounded-full hover:bg-black/5 transition-colors">
              <X size={18} className="text-black/60" />
            </Dialog.Close>
          </div>

          {/* Product info */}
          <div className="bg-[#F0F0F0] rounded-[13px] p-3 mb-4">
            <p className="text-sm font-medium text-black line-clamp-2 mb-1">{product.title}</p>
            <p className="text-lg font-bold text-black">${effectivePrice}</p>
            {product.discount.percentage > 0 && (
              <p className="text-xs text-black/50 line-through">${product.price}</p>
            )}
          </div>

          {/* Existing entry info */}
          {existingEntry && (
            <div className="mb-4 p-3 rounded-lg border border-black/10">
              <p className="text-xs text-black/50 mb-1">Current Target</p>
              <p className="text-sm font-medium text-black">${existingEntry.targetPrice}</p>
              {isPriceDropped && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs text-green-700 font-medium">
                  <Check size={12} /> 🎉 Target price reached!
                </span>
              )}
            </div>
          )}

          {/* Target price input */}
          <div className="mb-4">
            <label htmlFor="target-price" className="block text-sm font-medium text-black mb-1.5">
              Your Target Price <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/60 text-sm">$</span>
              <input
                id="target-price"
                type="number"
                min={1}
                step={1}
                value={targetPrice}
                onChange={(e) => {
                  setTargetPrice(e.target.value);
                  setError("");
                }}
                placeholder="Enter your target price"
                className={cn(
                  "w-full rounded-lg border px-4 pl-7 py-3 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 transition-all",
                  error ? "border-red-500" : "border-black/20"
                )}
              />
            </div>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            <p className="mt-1 text-xs text-black/40">
              We&apos;ll notify you when the price drops to your target.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 h-11 rounded-full bg-black text-white text-sm font-medium hover:bg-black/80 transition-all"
            >
              {existingEntry ? "Update Target" : "Track Price"}
            </button>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex-1 h-11 rounded-full border border-black/20 text-black text-sm font-medium hover:bg-black/5 transition-all"
              >
                Cancel
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default TrackPriceButton;
