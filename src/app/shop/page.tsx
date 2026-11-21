"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import BreadcrumbShop from "@/components/shop-page/BreadcrumbShop";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MobileFilters from "@/components/shop-page/filters/MobileFilters";
import Filters from "@/components/shop-page/filters";
import { FiSliders } from "react-icons/fi";
import { X } from "lucide-react";
import ProductCard from "@/components/common/ProductCard";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  getEffectivePrice,
  getFiltersFromSearchParams,
  getSearchParamsString,
  SORT_OPTIONS,
  ITEMS_PER_PAGE,
  toApiSort,
  type ShopFilters,
} from "@/lib/utils/productFilters";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchSearch } from "@/lib/api/search";
import { isAbortError } from "@/lib/api/client";
import type { Product } from "@/types/product.types";
import { cn } from "@/lib/utils";

const GENDER_TABS = [
  { label: "All", value: "" },
  { label: "Women", value: "women" },
  { label: "Men", value: "men" },
  { label: "Kids", value: "kids" },
] as const;

function readSearchParams(
  sp: ReturnType<typeof useSearchParams>
): Record<string, string | string[] | undefined> {
  const obj: Record<string, string | string[] | undefined> = {};
  sp.forEach((value, key) => {
    const existing = obj[key];
    if (existing) {
      obj[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      obj[key] = value;
    }
  });
  return obj;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${label} filter`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
    >
      <span className="max-w-[180px] truncate">{label}</span>
      <X size={12} className="shrink-0" aria-hidden />
    </button>
  );
}

/**
 * The backend search API accepts one category and one gender. Multi-select
 * categories/genders and the size/colour/style facets are applied to the
 * returned page set here, so existing filter behaviour is preserved.
 */
function matchesClientOnlyFilters(
  product: Product,
  filters: ShopFilters
): boolean {
  if (
    filters.category.length > 0 &&
    !filters.category.includes(product.category)
  ) {
    return false;
  }

  if (
    filters.gender.length > 0 &&
    !filters.gender.includes(product.gender ?? "unisex")
  ) {
    return false;
  }

  if (filters.minPrice > 0 || filters.maxPrice > 0) {
    const price = getEffectivePrice(product);
    if (filters.minPrice > 0 && price < filters.minPrice) return false;
    if (filters.maxPrice > 0 && price > filters.maxPrice) return false;
  }

  if (filters.style.length > 0) {
    const style = (product.style ?? "").toLowerCase();
    if (!filters.style.includes(style)) return false;
  }

  if (filters.size.length > 0) {
    const sizes = product.sizes ?? [];
    const matches = filters.size.some((size) =>
      sizes.some(
        (productSize) =>
          productSize.name.toLowerCase() === size.toLowerCase() ||
          productSize.label.toLowerCase() === size.toLowerCase()
      )
    );
    if (!matches) return false;
  }

  if (filters.color.length > 0) {
    const colors = product.colors ?? [];
    const matches = filters.color.some((color) =>
      colors.some(
        (productColor) =>
          productColor.name.toLowerCase() === color.toLowerCase() ||
          productColor.id.toLowerCase() === color.toLowerCase()
      )
    );
    if (!matches) return false;
  }

  return true;
}

function ShopContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramsObj = useMemo(() => readSearchParams(searchParams), [searchParams]);

  const filters = useMemo(
    () => getFiltersFromSearchParams(paramsObj),
    [paramsObj]
  );

  const [displayProducts, setDisplayProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const needsClientFiltering =
    filters.category.length > 1 ||
    filters.gender.length > 1 ||
    filters.style.length > 0 ||
    filters.size.length > 0 ||
    filters.color.length > 0 ||
    filters.minPrice > 0 ||
    filters.maxPrice > 0 ||
    filters.sort === "price-asc" ||
    filters.sort === "price-desc";

  useEffect(() => {
    const controller = new AbortController();
    const clientFiltered = needsClientFiltering;

    setIsLoading(true);
    setError(null);

    fetchSearch(
      {
        ...(filters.search ? { q: filters.search } : {}),
        page: clientFiltered ? 1 : filters.page,
        limit: clientFiltered ? 100 : ITEMS_PER_PAGE,
        ...(filters.category.length === 1
          ? { category: filters.category[0] }
          : {}),
        ...(filters.gender.length === 1
          ? {
              gender: filters.gender[0] as
                | "men"
                | "women"
                | "kids"
                | "unisex",
            }
          : {}),
        // Price is matched on the discounted price the cards display, so it
        // is applied client-side rather than by the backend's raw price.
        ...(!clientFiltered && filters.minPrice > 0
          ? { minPrice: filters.minPrice }
          : {}),
        ...(!clientFiltered && filters.maxPrice > 0
          ? { maxPrice: filters.maxPrice }
          : {}),
        ...(filters.available ? { available: "true" as const } : {}),
        sort: toApiSort(filters.sort),
      },
      controller.signal
    )
      .then((response) => {
        if (controller.signal.aborted) return;

        if (!clientFiltered) {
          setDisplayProducts(response.data);
          setTotalCount(response.pagination.total);
          return;
        }

        const filtered = response.data.filter((product) =>
          matchesClientOnlyFilters(product, filters)
        );
        if (filters.sort === "price-asc" || filters.sort === "price-desc") {
          filtered.sort((a, b) => {
            const delta = getEffectivePrice(a) - getEffectivePrice(b);
            return filters.sort === "price-asc" ? delta : -delta;
          });
        }
        const start = (filters.page - 1) * ITEMS_PER_PAGE;
        setDisplayProducts(filtered.slice(start, start + ITEMS_PER_PAGE));
        setTotalCount(filtered.length);
      })
      .catch((err) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        setDisplayProducts([]);
        setTotalCount(0);
        setError(
          err instanceof Error
            ? err.message
            : "Could not load products. Check that the backend is running."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [filters, needsClientFiltering, retryToken]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const updateFilter = useCallback(
    (overrides: Partial<ShopFilters>) => {
      const newFilters = { ...filters, ...overrides, page: 1 };
      const qs = getSearchParamsString(newFilters);
      router.push(`/shop${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [filters, router]
  );

  const clearFilters = useCallback(() => {
    router.push("/shop", { scroll: false });
  }, [router]);

  const handlePageChange = useCallback(
    (page: number) => {
      const qs = getSearchParamsString(filters, { page });
      router.push(`/shop${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [filters, router]
  );

  const heading = useMemo(() => {
    if (filters.search) return `Search: "${filters.search}"`;
    if (filters.category.length === 1) {
      const name = filters.category[0]
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return name;
    }
    if (filters.gender.length === 1) {
      const g = filters.gender[0];
      return `${g.charAt(0).toUpperCase() + g.slice(1)}'s Collection`;
    }
    return "All Clothing";
  }, [filters.search, filters.category, filters.gender]);

  const startItem =
    totalCount > 0 ? (filters.page - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endItem = Math.min(filters.page * ITEMS_PER_PAGE, totalCount);

  const hasActiveFilters =
    filters.search ||
    filters.category.length > 0 ||
    filters.gender.length > 0 ||
    filters.style.length > 0 ||
    filters.size.length > 0 ||
    filters.color.length > 0 ||
    filters.minPrice > 0 ||
    filters.maxPrice > 0 ||
    filters.available;

  return (
    <main className="pb-20">
      <div className="max-w-frame mx-auto px-4 xl:px-0">
        <hr className="h-[1px] border-t-black/10 mb-5 sm:mb-6" />
        <BreadcrumbShop />

        <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mb-6 sm:gap-3 xl:mx-0 xl:px-0">
          {GENDER_TABS.map((tab) => {
            const isActive =
              tab.value === ""
                ? filters.gender.length === 0
                : filters.gender.length === 1 && filters.gender[0] === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() =>
                  updateFilter({
                    gender: tab.value ? [tab.value] : [],
                  })
                }
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all sm:px-5",
                  isActive
                    ? "bg-black text-white"
                    : "bg-[#F0F0F0] text-black/60 hover:text-black"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex md:space-x-5 items-start">
          <div className="hidden md:block min-w-[295px] max-w-[295px] border border-black/10 rounded-[20px] px-5 md:px-6 py-5 space-y-5 md:space-y-6">
            <div className="flex items-center justify-between">
              <span className="font-bold text-black text-xl">Filters</span>
              <FiSliders className="text-2xl text-black/40" />
            </div>
            <Filters filters={filters} onUpdate={updateFilter} onClear={clearFilters} />
          </div>
          <div className="flex flex-col w-full space-y-5">
            <div className="flex flex-col lg:flex-row lg:justify-between">
              <div className="flex items-center justify-between">
                <h1 className="font-bold text-2xl md:text-[32px]">{heading}</h1>
                <MobileFilters
                  filters={filters}
                  onUpdate={updateFilter}
                  onClear={clearFilters}
                />
              </div>
              <div className="flex flex-col sm:items-center sm:flex-row">
                <span
                  className="text-sm md:text-base text-black/60 mr-3"
                  aria-live="polite"
                >
                  {isLoading
                    ? "Loading products…"
                    : error
                      ? "Products unavailable"
                      : totalCount === 0
                        ? "No products"
                        : `Showing ${startItem}-${endItem} of ${totalCount} Products`}
                </span>
                <div className="flex items-center">
                  Sort by:{" "}
                  <Select
                    value={filters.sort}
                    onValueChange={(value) =>
                      updateFilter({ sort: value as ShopFilters["sort"] })
                    }
                  >
                    <SelectTrigger className="font-medium text-sm px-1.5 sm:text-base w-fit text-black bg-transparent shadow-none border-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2">
                {filters.category.map((c) => (
                  <FilterChip
                    key={`cat-${c}`}
                    label={c.replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())}
                    onRemove={() =>
                      updateFilter({
                        category: filters.category.filter((x) => x !== c),
                      })
                    }
                  />
                ))}
                {filters.gender.map((g) => (
                  <FilterChip
                    key={`gender-${g}`}
                    label={g.charAt(0).toUpperCase() + g.slice(1)}
                    onRemove={() =>
                      updateFilter({
                        gender: filters.gender.filter((x) => x !== g),
                      })
                    }
                  />
                ))}
                {filters.size.map((s) => (
                  <FilterChip
                    key={`size-${s}`}
                    label={`Size: ${s}`}
                    onRemove={() =>
                      updateFilter({
                        size: filters.size.filter((x) => x !== s),
                      })
                    }
                  />
                ))}
                {filters.color.map((c) => (
                  <FilterChip
                    key={`color-${c}`}
                    label={`Color: ${c}`}
                    onRemove={() =>
                      updateFilter({
                        color: filters.color.filter((x) => x !== c),
                      })
                    }
                  />
                ))}
                {filters.style.map((s) => (
                  <FilterChip
                    key={`style-${s}`}
                    label={s}
                    onRemove={() =>
                      updateFilter({
                        style: filters.style.filter((x) => x !== s),
                      })
                    }
                  />
                ))}
                {(filters.minPrice > 0 || filters.maxPrice > 0) && (
                  <FilterChip
                    label={`$${filters.minPrice || 0} – $${filters.maxPrice || "∞"}`}
                    onRemove={() => updateFilter({ minPrice: 0, maxPrice: 0 })}
                  />
                )}
                {filters.available && (
                  <FilterChip
                    label="In stock"
                    onRemove={() => updateFilter({ available: false })}
                  />
                )}
                {filters.search && (
                  <FilterChip
                    label={`"${filters.search}"`}
                    onRemove={() => updateFilter({ search: "" })}
                  />
                )}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-1 text-xs font-medium text-black/60 underline hover:text-black"
                >
                  Clear All
                </button>
              </div>
            )}
            {isLoading ? (
              <div
                className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5"
                aria-busy="true"
                aria-label="Loading products"
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="flex flex-col items-start">
                    <div className="w-full aspect-square rounded-[13px] lg:rounded-[20px] bg-[#F0EEED] animate-pulse mb-2.5 xl:mb-4" />
                    <div className="h-4 w-3/4 rounded bg-black/5 animate-pulse mb-2" />
                    <div className="h-4 w-1/3 rounded bg-black/5 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-2xl font-bold text-black mb-2">
                  We couldn&apos;t load products
                </p>
                <p className="text-black/60 text-sm sm:text-base mb-2 text-center max-w-md break-words">
                  {error}
                </p>
                <p className="text-black/40 text-xs sm:text-sm mb-6 text-center">
                  Check your connection and make sure the ShopSphere backend is
                  running.
                </p>
                <button
                  type="button"
                  onClick={() => setRetryToken((value) => value + 1)}
                  className="px-8 py-3 bg-black text-white rounded-full text-sm font-medium hover:bg-black/80 transition-all"
                >
                  Try Again
                </button>
              </div>
            ) : displayProducts.length > 0 ? (
              <div className="grid w-full grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
                {displayProducts.map((product) => (
                  <ProductCard key={product.id} data={product} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-2xl font-bold text-black mb-2">
                  No pieces found
                </p>
                <p className="text-black/60 text-sm sm:text-base mb-6 text-center">
                  Try adjusting your filters or search.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-8 py-3 bg-black text-white rounded-full text-sm font-medium hover:bg-black/80 transition-all"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {!isLoading && !error && totalPages > 1 && (
              <>
                <hr className="border-t-black/10" />
                <Pagination className="justify-between gap-2">
                  <PaginationPrevious
                    href="#"
                    className="h-10 border border-black/10 px-2.5 xs:px-3"
                    onClick={(e) => {
                      e.preventDefault();
                      if (filters.page > 1) handlePageChange(filters.page - 1);
                    }}
                  />
                  <span className="text-xs font-medium text-black/50 sm:hidden">
                    Page {filters.page} of {totalPages}
                  </span>
                  <PaginationContent className="hidden sm:flex">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => {
                        if (totalPages <= 5) return true;
                        if (p === 1 || p === totalPages) return true;
                        if (Math.abs(p - filters.page) <= 1) return true;
                        return false;
                      })
                      .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                        if (idx > 0) {
                          const prev = arr[idx - 1];
                          if (p - prev > 1) acc.push("ellipsis");
                        }
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === "ellipsis" ? (
                          <PaginationItem key={`ellipsis-${idx}`}>
                            <PaginationEllipsis className="text-black/50 font-medium text-sm" />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={item}>
                            <PaginationLink
                              href="#"
                              className="text-black/50 font-medium text-sm"
                              isActive={item === filters.page}
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(item);
                              }}
                            >
                              {item}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      )}
                  </PaginationContent>
                  <PaginationNext
                    href="#"
                    className="h-10 border border-black/10 px-2.5 xs:px-3"
                    onClick={(e) => {
                      e.preventDefault();
                      if (filters.page < totalPages)
                        handlePageChange(filters.page + 1);
                    }}
                  />
                </Pagination>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ShopPage() {
  return (
    <React.Suspense
      fallback={
        <main className="pb-20">
          <div className="max-w-frame mx-auto px-4 xl:px-0 flex items-center justify-center h-96">
            <div className="w-10 h-10 rounded-full border-2 border-gray-300 border-r-gray-600 animate-spin" />
          </div>
        </main>
      }
    >
      <ShopContent />
    </React.Suspense>
  );
}
