"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Search, X, Loader2, RefreshCw } from "lucide-react";
import { useProductAutocomplete } from "@/lib/hooks/useProductAutocomplete";
import type { ProductSuggestion } from "@/lib/api/search";

const MAX_RESULTS = 6;

function getDisplayPrice(product: ProductSuggestion): string {
  return `$${product.price}`;
}

function formatCategory(category: string): string {
  return category
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { suggestions, isLoading, error, retry } = useProductAutocomplete(
    query,
    { limit: MAX_RESULTS }
  );

  const trimmedQuery = query.trim();
  const isTooShort = trimmedQuery.length === 1;
  const showDropdown = isOpen && trimmedQuery.length > 0;

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      closeDropdown();
      if (q) {
        router.push(`/shop?search=${encodeURIComponent(q)}`);
      } else {
        router.push("/shop");
      }
    },
    [query, router, closeDropdown]
  );

  const handleResultClick = useCallback(
    (product: ProductSuggestion) => {
      closeDropdown();
      setQuery("");
      router.push(`/shop/product/${product.id}/${product.slug}`);
    },
    [router, closeDropdown]
  );

  const handleViewAll = useCallback(() => {
    const q = query.trim();
    closeDropdown();
    if (q) {
      router.push(`/shop?search=${encodeURIComponent(q)}`);
    } else {
      router.push("/shop");
    }
  }, [query, router, closeDropdown]);

  const handleClear = useCallback(() => {
    setQuery("");
    closeDropdown();
    inputRef.current?.focus();
  }, [closeDropdown]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      setActiveIndex(-1);
      setIsOpen(value.trim().length > 0);
    },
    []
  );

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeDropdown]);

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        closeDropdown();
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeDropdown]);

  // Keyboard navigation within dropdown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown || suggestions.length === 0) return;

      const itemCount = suggestions.length;
      const totalRows = itemCount + 1; // +1 for "View all results"

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % totalRows);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev <= 0 ? totalRows - 1 : prev - 1));
          break;
        case "Enter":
          if (activeIndex >= 0 && activeIndex < itemCount) {
            e.preventDefault();
            handleResultClick(suggestions[activeIndex]);
          } else if (activeIndex === itemCount) {
            e.preventDefault();
            handleViewAll();
          }
          break;
        case "Tab":
          closeDropdown();
          break;
      }
    },
    [
      showDropdown,
      suggestions,
      activeIndex,
      handleResultClick,
      handleViewAll,
      closeDropdown,
    ]
  );

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    items[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={cn(
            "input-group focus-within:shadow-lg pl-4 transition-all relative flex items-center w-full rounded-full overflow-hidden bg-[#F0F0F0]"
          )}
        >
          <div className="input-group-text mr-3">
            <Image
              priority
              src="/icons/search.svg"
              height={20}
              width={20}
              alt="search"
              className="min-w-5 min-h-5"
            />
          </div>
          <input
            ref={inputRef}
            type="text"
            name="search"
            placeholder="Search for products..."
            className="input-control w-full py-3 pr-4 outline-none placeholder:font-normal placeholder:text-sm bg-transparent placeholder:text-black/40"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (query.trim()) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="search-results-listbox"
            aria-activedescendant={
              activeIndex >= 0 ? `search-result-${activeIndex}` : undefined
            }
            aria-label="Search products"
            aria-autocomplete="list"
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
              onClick={handleClear}
              className="mr-3 p-0.5 rounded-full hover:bg-black/10 transition-colors flex-shrink-0"
              aria-label="Clear search"
            >
              <X size={16} className="text-black/40" />
            </button>
          )}
        </div>
      </form>

      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-black/10 rounded-2xl shadow-lg z-50 overflow-hidden max-h-[70vh] flex flex-col"
          aria-busy={isLoading}
        >
          {isTooShort ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium text-black mb-1">
                Keep typing…
              </p>
              <p className="text-xs text-black/50">
                Enter at least 2 characters to see suggestions
              </p>
            </div>
          ) : isLoading && suggestions.length === 0 ? (
            <div className="px-4 py-8 flex items-center justify-center gap-2 text-sm text-black/60">
              <Loader2 size={18} className="animate-spin" />
              Searching…
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium text-black mb-1">
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
              <ul
                ref={listRef}
                id="search-results-listbox"
                role="listbox"
                aria-label="Search results"
                className="overflow-y-auto flex-1 divide-y divide-black/5"
              >
                {suggestions.map((product, index) => (
                  <li
                    key={product.id}
                    id={`search-result-${index}`}
                    role="option"
                    aria-selected={activeIndex === index}
                  >
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                        activeIndex === index
                          ? "bg-[#F0F0F0]"
                          : "hover:bg-[#F0F0F0]/60"
                      )}
                      onClick={() => handleResultClick(product)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[#F0F0F0] flex-shrink-0">
                        <Image
                          src={product.imageUrl}
                          alt={product.title}
                          fill
                          sizes="48px"
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
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={cn(
                  "w-full px-4 py-3 text-center text-sm font-medium border-t border-black/10 transition-colors",
                  activeIndex === suggestions.length
                    ? "bg-[#F0F0F0] text-black"
                    : "text-black/60 hover:bg-[#F0F0F0]/60 hover:text-black"
                )}
                onClick={handleViewAll}
                onMouseEnter={() => setActiveIndex(suggestions.length)}
                role="option"
                aria-selected={activeIndex === suggestions.length}
                id={`search-result-${suggestions.length}`}
              >
                View all results →
              </button>
            </>
          ) : (
            <div className="px-4 py-8 text-center">
              <Search size={32} className="mx-auto text-black/20 mb-3" />
              <p className="text-sm font-medium text-black mb-1">
                No results found
              </p>
              <p className="text-xs text-black/50">
                Try a different search term
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
