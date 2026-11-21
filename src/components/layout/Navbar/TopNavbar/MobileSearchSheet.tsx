"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Search, X, Loader2, RefreshCw } from "lucide-react";
import { useProductAutocomplete } from "@/lib/hooks/useProductAutocomplete";
import type { ProductSuggestion } from "@/lib/api/search";

const MAX_RESULTS = 8;

function getDisplayPrice(product: ProductSuggestion): string {
  return `$${product.price}`;
}

function formatCategory(category: string): string {
  return category
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MobileSearchSheet() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { suggestions, isLoading, error, retry } = useProductAutocomplete(
    query,
    { limit: MAX_RESULTS }
  );

  const trimmedQuery = query.trim();
  const isTooShort = trimmedQuery.length === 1;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      setIsOpen(false);
      setQuery("");
      if (q) {
        router.push(`/shop?search=${encodeURIComponent(q)}`);
      } else {
        router.push("/shop");
      }
    },
    [query, router]
  );

  const handleResultClick = useCallback(
    (product: ProductSuggestion) => {
      setIsOpen(false);
      setQuery("");
      router.push(`/shop/product/${product.id}/${product.slug}`);
    },
    [router]
  );

  const handleViewAll = useCallback(() => {
    const q = query.trim();
    setIsOpen(false);
    setQuery("");
    if (q) {
      router.push(`/shop?search=${encodeURIComponent(q)}`);
    } else {
      router.push("/shop");
    }
  }, [query, router]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild className="md:hidden cursor-pointer">
        <button
          type="button"
          aria-label="Search"
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5 transition-colors"
        >
          <Search size={20} className="text-black" />
        </button>
      </SheetTrigger>
      <SheetContent side="top" className="h-auto max-h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Search Products</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="focus-within:shadow-lg pl-4 transition-all relative flex items-center w-full rounded-full overflow-hidden bg-[#F0F0F0]">
            <div className="mr-3 shrink-0">
              <Search size={18} className="text-black/50" />
            </div>
            <input
              ref={inputRef}
              type="text"
              name="search"
              placeholder="Search for products..."
              className="w-full py-3 pr-4 outline-none placeholder:font-normal placeholder:text-sm bg-transparent placeholder:text-black/40"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search products"
            />
            {isLoading && (
              <Loader2
                size={16}
                className="mr-2 animate-spin text-black/40 flex-shrink-0"
                aria-hidden="true"
              />
            )}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="mr-3 p-0.5 rounded-full hover:bg-black/10 transition-colors flex-shrink-0"
                aria-label="Clear search"
              >
                <X size={16} className="text-black/40" />
              </button>
            )}
          </div>
        </form>

        {trimmedQuery && (
          <div className="space-y-1" aria-busy={isLoading}>
            {isTooShort ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-black mb-0.5">
                  Keep typing…
                </p>
                <p className="text-xs text-black/50">
                  Enter at least 2 characters to see suggestions
                </p>
              </div>
            ) : isLoading && suggestions.length === 0 ? (
              <div className="py-8 flex items-center justify-center gap-2 text-sm text-black/60">
                <Loader2 size={18} className="animate-spin" />
                Searching…
              </div>
            ) : error ? (
              <div className="py-8 text-center px-4">
                <p className="text-sm font-medium text-black mb-0.5">
                  Search is unavailable
                </p>
                <p className="text-xs text-black/50 mb-4 break-words">{error}</p>
                <button
                  type="button"
                  onClick={retry}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black text-white text-xs font-medium hover:bg-black/80 transition-colors"
                >
                  <RefreshCw size={14} />
                  Try again
                </button>
              </div>
            ) : suggestions.length > 0 ? (
              <>
                <div className="space-y-1">
                  {suggestions.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[#F0F0F0] transition-colors"
                      onClick={() => handleResultClick(product)}
                    >
                      <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-[#F0F0F0] flex-shrink-0">
                        <Image
                          src={product.imageUrl}
                          alt={product.title}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black truncate">
                          {product.title}
                        </p>
                        <p className="text-xs text-black/50 mt-0.5">
                          {formatCategory(product.category)}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-black flex-shrink-0">
                        {getDisplayPrice(product)}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleViewAll}
                  className="w-full px-3 py-2.5 text-center text-sm font-medium text-black/60 hover:text-black rounded-xl hover:bg-[#F0F0F0] transition-colors"
                >
                  View all results →
                </button>
              </>
            ) : (
              <div className="py-8 text-center">
                <Search size={28} className="mx-auto text-black/20 mb-2" />
                <p className="text-sm font-medium text-black mb-0.5">
                  No results found
                </p>
                <p className="text-xs text-black/50">
                  Try a different search term
                </p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
