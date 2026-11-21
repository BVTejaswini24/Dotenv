"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAutocomplete,
  fetchSearch,
  type ProductSuggestion,
} from "@/lib/api/search";
import { isAbortError } from "@/lib/api/client";

type Options = {
  limit: number;
  debounceMs?: number;
  enabled?: boolean;
};

/**
 * Fetches backend autocomplete suggestions for a query.
 *
 * - Debounced so typing does not issue a request per keystroke.
 * - The previous request is aborted when the query changes or the component
 *   unmounts, so stale responses can never overwrite newer results.
 * - retry() re-runs only the failed request.
 */
export function useProductAutocomplete(query: string, options: Options) {
  const { limit, debounceMs = 250, enabled = true } = options;
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();

    if (!enabled || q.length < 2) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const response = await fetchAutocomplete(q, limit, controller.signal);
        if (controller.signal.aborted) return;

        if (response.data.length > 0) {
          setSuggestions(response.data);
          return;
        }

        // Autocomplete is prefix-based. If it has no prefix match, fall back
        // once to the fuzzy search endpoint so typos still show suggestions.
        const fuzzy = await fetchSearch(
          { q, limit, sort: "relevance" },
          controller.signal
        );
        if (controller.signal.aborted) return;
        setSuggestions(
          fuzzy.data.map((product) => ({
            id: product.id,
            slug: product.slug,
            title: product.title,
            brand: product.brand,
            category: product.category,
            categoryName: product.categoryName ?? product.category,
            price: product.price,
            imageUrl: product.srcUrl,
            stock: product.stock ?? 0,
          }))
        );
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err)) return;
        setSuggestions([]);
        setError(
          err instanceof Error
            ? err.message
            : "Could not load suggestions. Check that the backend is running."
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, limit, debounceMs, enabled, retryToken]);

  const retry = useCallback(() => setRetryToken((value) => value + 1), []);

  return { suggestions, isLoading, error, retry };
}
