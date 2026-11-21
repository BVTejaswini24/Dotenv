"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, CheckCircle, Check, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { integralCF } from "@/styles/fonts";
import { useAppDispatch, useAppSelector } from "@/lib/hooks/redux";
import { selectCurrentUser, selectIsAuthenticated } from "@/lib/features/auth/authSlice";
import {
  selectUserWatchlist,
  removeFromWatchlist,
  WatchlistEntry,
} from "@/lib/features/watchlist/watchlistSlice";
import { Button } from "@/components/ui/button";
import BreadcrumbAuth from "@/components/auth-page/BreadcrumbAuth";

function StatusBadge({ status }: { status: WatchlistEntry["status"] }) {
  if (status === "reached") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700">
        <CheckCircle size={12} />
        Price Dropped! 🎉
      </span>
    );
  }
  if (status === "notified") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
        <Check size={12} />
        Notified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
      <Bell size={12} />
      Watching
    </span>
  );
}

export default function WatchlistPage() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectCurrentUser);
  const entries = useAppSelector(selectUserWatchlist(user?.id ?? ""));

  if (!isAuthenticated || !user) {
    return (
      <main className="pb-20">
        <div className="max-w-frame mx-auto px-4 xl:px-0">
          <BreadcrumbAuth page="Price Watchlist" />
          <div className="flex items-center justify-center mt-4 md:mt-16">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-full bg-black/5 mx-auto mb-6 flex items-center justify-center">
                <User className="text-black/30" size={36} />
              </div>
              <h1
                className={cn([
                  integralCF.className,
                  "text-2xl md:text-3xl font-bold text-black mb-3",
                ])}
              >
                Sign In Required
              </h1>
              <p className="text-black/60 text-sm mb-8">
                Please sign in to view your price watchlist and track price drops.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button className="flex-1 rounded-full h-12 bg-black text-white hover:bg-black/90" asChild>
                  <Link href="/signin">Sign In</Link>
                </Button>
                <Button variant="outline" className="flex-1 rounded-full h-12" asChild>
                  <Link href="/signup">Create Account</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const handleRemove = (id: string, title: string) => {
    dispatch(removeFromWatchlist(id));
    toast.success(`Removed "${title}" from watchlist`);
  };

  return (
    <main className="pb-20">
      <div className="max-w-frame mx-auto px-4 xl:px-0">
        <BreadcrumbAuth page="Price Watchlist" />

        <h1
          className={cn([
            integralCF.className,
            "font-bold text-[32px] md:text-[40px] text-black uppercase mb-5 md:mb-6",
          ])}
        >
          My Price Watchlist
        </h1>

        {/* Disclaimer note */}
        <div className="mb-6 p-3 rounded-lg bg-[#F0F0F0] text-xs text-black/50 flex items-start gap-2">
          <Bell size={14} className="mt-0.5 shrink-0" />
          <span>
            Price data is simulated. In production, prices would be monitored in real-time.
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-black/5 mx-auto mb-6 flex items-center justify-center">
              <Bell className="text-black/30" size={36} />
            </div>
            <h2 className="text-lg font-bold text-black mb-2">No tracked products yet</h2>
            <p className="text-black/50 text-sm mb-8 max-w-sm">
              You&apos;re not tracking any products yet. Browse products and click &apos;Track
              Price&apos; to get notified of price drops.
            </p>
            <Button className="rounded-full h-12 px-8 bg-black text-white hover:bg-black/90" asChild>
              <Link href="/shop">Browse Products</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const savings = entry.currentPrice - entry.targetPrice;
              const savingsLabel = savings > 0 ? `$${savings.toFixed(0)} to go` : `$${Math.abs(savings).toFixed(0)} saved`;
              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-[20px] border border-black/10 p-4 md:p-5 flex gap-4"
                >
                  {/* Product image */}
                  <div className="relative w-20 h-20 shrink-0 rounded-[13px] overflow-hidden bg-[#F0EEED]">
                    <Image
                      src={entry.productSrcUrl}
                      alt={entry.productTitle}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/shop`}
                      className="font-bold text-sm text-black hover:underline line-clamp-1"
                    >
                      {entry.productTitle}
                    </Link>
                    <p className="text-xs text-black/50 capitalize mt-0.5 mb-2">
                      {entry.productCategory.replace(/-/g, " ")}
                    </p>
                    <StatusBadge status={entry.status} />
                    <p className="text-xs text-black/40 mt-2">
                      Added:{" "}
                      {new Date(entry.addedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Price info */}
                  <div className="shrink-0 text-right space-y-1">
                    <div>
                      <p className="text-xs text-black/40">Target</p>
                      <p className="text-sm font-bold text-black">${entry.targetPrice}</p>
                    </div>
                    <div>
                      <p className="text-xs text-black/40">Current</p>
                      <p className="text-sm font-medium text-black">${entry.currentPrice}</p>
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-xs font-medium",
                          savings <= 0 ? "text-green-600" : "text-black/40"
                        )}
                      >
                        {savingsLabel}
                      </p>
                    </div>
                  </div>

                  {/* Remove */}
                  <div className="shrink-0 flex items-start">
                    <button
                      type="button"
                      onClick={() => handleRemove(entry.id, entry.productTitle)}
                      className="p-2 rounded-full hover:bg-red-50 text-black/30 hover:text-red-500 transition-colors"
                      aria-label="Remove from watchlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
