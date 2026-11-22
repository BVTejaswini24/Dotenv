import type { Product } from "@/types/product.types";
import { apiGet } from "./client";

export type SearchSort =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "newest"
  | "title";

export type SearchParams = {
  q?: string;
  page?: number;
  limit?: number;
  category?: string;
  gender?: "men" | "women" | "kids" | "unisex";
  minPrice?: number;
  maxPrice?: number;
  available?: "true" | "false";
  sort?: SearchSort;
};

export type SearchPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type SearchMeta = {
  backend: "opensearch" | "postgres";
  degraded: boolean;
  tookMs: number;
  reason?: string;
};

export type SearchResponse = {
  data: Product[];
  pagination: SearchPagination;
  meta: SearchMeta;
};

export type ProductSuggestion = {
  id: number;
  slug: string;
  title: string;
  brand: string;
  category: string;
  categoryName: string;
  price: number;
  imageUrl: string;
  stock: number;
};

export type AutocompleteResponse = {
  data: ProductSuggestion[];
  meta: SearchMeta;
};

export async function fetchSearch(
  params: SearchParams,
  signal?: AbortSignal
): Promise<SearchResponse> {
  const query = new URLSearchParams();

  if (params.q) query.set("q", params.q);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.category) query.set("category", params.category);
  if (params.gender) query.set("gender", params.gender);
  if (params.minPrice !== undefined) {
    query.set("minPrice", String(params.minPrice));
  }
  if (params.maxPrice !== undefined) {
    query.set("maxPrice", String(params.maxPrice));
  }
  if (params.available) query.set("available", params.available);
  if (params.sort) query.set("sort", params.sort);

  return apiGet<SearchResponse>(`/api/search?${query.toString()}`, signal);
}

export async function fetchAutocomplete(
  q: string,
  limit: number,
  signal?: AbortSignal
): Promise<AutocompleteResponse> {
  const query = new URLSearchParams({ q, limit: String(limit) });
  return apiGet<AutocompleteResponse>(
    `/api/search/autocomplete?${query.toString()}`,
    signal
  );
}
