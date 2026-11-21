import { z } from "zod";
import {
  getProductsByLegacyIds,
  listProducts,
  type ListProductsQuery,
  type ProductDto,
} from "../products/products.service";
import { paginationMeta, resolvePagination } from "../../lib/http";
import { env } from "../../config/env";
import { getSearchClient, isSearchConfigured } from "./opensearch.client";

/**
 * Product search backed by OpenSearch, hydrated from PostgreSQL.
 *
 * OpenSearch owns relevance, filtering and pagination. The returned objects
 * are the same ProductDto shape as GET /api/products, loaded in ranked order
 * from PostgreSQL, so the existing frontend contract is unchanged.
 */

const SORT_VALUES = [
  "relevance",
  "price_asc",
  "price_desc",
  "rating",
  "newest",
  "title",
] as const;

export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional().default(""),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
    category: z.string().trim().min(1).max(80).optional(),
    gender: z.enum(["men", "women", "kids", "unisex"]).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    available: z.enum(["true", "false"]).optional(),
    sort: z.enum(SORT_VALUES).default("relevance"),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    { message: "minPrice must be less than or equal to maxPrice", path: ["maxPrice"] }
  );

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const autocompleteQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export type AutocompleteQuery = z.infer<typeof autocompleteQuerySchema>;

export type SearchMeta = {
  backend: "opensearch" | "postgres";
  degraded: boolean;
  tookMs: number;
  reason?: string;
};

export type SearchResponse = {
  data: ProductDto[];
  pagination: ReturnType<typeof paginationMeta>;
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

type OpenSearchHit = {
  _source?: {
    id?: number;
    slug?: string;
    title?: string;
    brand?: string;
    category?: string;
    category_name?: string;
    price?: number;
    image_url?: string;
    stock?: number;
  };
};

function totalHits(body: {
  hits?: { total?: number | { value?: number } };
}): number {
  const total = body.hits?.total;
  if (typeof total === "number") return total;
  return total?.value ?? 0;
}

function sortFor(
  sort: SearchQuery["sort"]
): Array<Record<string, unknown>> {
  switch (sort) {
    case "price_asc":
      return [{ price: "asc" }, { _score: "desc" }];
    case "price_desc":
      return [{ price: "desc" }, { _score: "desc" }];
    case "rating":
      return [{ rating: "desc" }, { _score: "desc" }];
    case "newest":
      return [{ created_at: "desc" }, { _score: "desc" }];
    case "title":
      return [{ "title.keyword": "asc" }];
    case "relevance":
    default:
      return [{ _score: "desc" }];
  }
}

function buildFilters(query: SearchQuery): Record<string, unknown>[] {
  const filters: Record<string, unknown>[] = [{ term: { is_active: true } }];

  if (query.category) {
    filters.push({ term: { category: query.category } });
  }
  if (query.gender) {
    filters.push({ term: { gender: query.gender } });
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filters.push({
      range: {
        price: {
          ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
          ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
        },
      },
    });
  }
  if (query.available === "true") {
    filters.push({ range: { stock: { gt: 0 } } });
  }
  if (query.available === "false") {
    filters.push({ range: { stock: { lte: 0 } } });
  }

  return filters;
}

/**
 * Exact phrase matches receive the highest boost, then all-term title
 * matches, then fuzzy matches across title/brand/description/category.
 * That ordering keeps an exact hit above a typo-tolerant one.
 */
function buildTextClause(q: string): Record<string, unknown> {
  return {
    bool: {
      should: [
        { match_phrase: { title: { query: q, boost: 12, slop: 1 } } },
        {
          match_phrase_prefix: {
            title: { query: q, boost: 5, max_expansions: 50 },
          },
        },
        {
          match: {
            title: {
              query: q,
              boost: 6,
              operator: "and",
              fuzziness: "AUTO",
              prefix_length: 1,
            },
          },
        },
        {
          match: {
            "brand.text": {
              query: q,
              boost: 2,
              fuzziness: "AUTO",
              prefix_length: 1,
            },
          },
        },
        {
          match: {
            "category_name.text": {
              query: q,
              boost: 1.5,
              fuzziness: "AUTO",
            },
          },
        },
        {
          match: {
            description: {
              query: q,
              boost: 1,
              fuzziness: "AUTO",
              prefix_length: 1,
            },
          },
        },
        { term: { tags: { value: q, boost: 2, case_insensitive: true } } },
      ],
      minimum_should_match: 1,
    },
  };
}

async function postgresSearch(
  query: SearchQuery,
  pagination: ReturnType<typeof resolvePagination>,
  reason?: string
): Promise<SearchResponse> {
  const started = Date.now();
  const pgQuery: ListProductsQuery = {
    page: pagination.page,
    limit: pagination.limit,
    ...(query.q ? { q: query.q } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.gender ? { gender: query.gender } : {}),
    ...(query.minPrice !== undefined ? { minPrice: query.minPrice } : {}),
    ...(query.maxPrice !== undefined ? { maxPrice: query.maxPrice } : {}),
    ...(query.available ? { available: query.available } : {}),
    sort: query.sort,
  };

  const { products, total } = await listProducts(pgQuery);
  return {
    data: products,
    pagination: paginationMeta(total, pagination),
    meta: {
      backend: "postgres",
      degraded: Boolean(reason),
      tookMs: Date.now() - started,
      ...(reason ? { reason } : {}),
    },
  };
}

export async function searchProducts(query: SearchQuery): Promise<SearchResponse> {
  const pagination = resolvePagination(query.page, query.limit);

  // Empty query is a normal browse request; PostgreSQL already handles it
  // correctly and avoids an unnecessary search round trip.
  if (!query.q) {
    return postgresSearch(query, pagination);
  }

  if (!isSearchConfigured()) {
    return postgresSearch(query, pagination, "OpenSearch is not configured");
  }

  const started = Date.now();
  try {
    const response = await getSearchClient().search({
      index: env.opensearchIndex,
      body: {
        from: pagination.offset,
        size: pagination.limit,
        track_total_hits: true,
        query: {
          bool: {
            must: [buildTextClause(query.q)],
            filter: buildFilters(query),
          },
        },
        sort: sortFor(query.sort),
      },
    });

    const body = response.body as {
      hits?: { hits?: OpenSearchHit[]; total?: number | { value?: number } };
    };
    const hits = body.hits?.hits ?? [];
    const total = totalHits(body);
    const ids = hits
      .map((hit) => hit._source?.id)
      .filter((id): id is number => typeof id === "number");

    const products = await getProductsByLegacyIds(ids);

    return {
      data: products,
      pagination: paginationMeta(total, pagination),
      meta: {
        backend: "opensearch",
        degraded: false,
        tookMs: Date.now() - started,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "search failed";
    console.warn("[search] OpenSearch unavailable; using PostgreSQL fallback:", message);
    return postgresSearch(query, pagination, "OpenSearch unavailable");
  }
}

export type AutocompleteResponse = {
  data: ProductSuggestion[];
  meta: SearchMeta;
};

function toSuggestion(hit: OpenSearchHit): ProductSuggestion | null {
  const source = hit._source;
  if (!source || typeof source.id !== "number" || !source.title) return null;
  return {
    id: source.id,
    slug: source.slug ?? "",
    title: source.title,
    brand: source.brand ?? "",
    category: source.category ?? "",
    categoryName: source.category_name ?? "",
    price: Number(source.price ?? 0),
    imageUrl: source.image_url ?? "",
    stock: Number(source.stock ?? 0),
  };
}

export async function autocompleteProducts(
  query: AutocompleteQuery
): Promise<AutocompleteResponse> {
  const started = Date.now();
  const q = query.q.trim();

  // The edge-ngram analyzer has min_gram 2, so a single character cannot match.
  if (q.length < 2) {
    return {
      data: [],
      meta: { backend: "opensearch", degraded: false, tookMs: 0 },
    };
  }

  if (!isSearchConfigured()) {
    return autocompleteFromPostgres(q, query.limit, "OpenSearch is not configured");
  }

  try {
    const response = await getSearchClient().search({
      index: env.opensearchIndex,
      body: {
        size: query.limit,
        _source: [
          "id",
          "slug",
          "title",
          "brand",
          "category",
          "category_name",
          "price",
          "image_url",
          "stock",
        ],
        query: {
          bool: {
            must: [
              {
                match: {
                  "title.autocomplete": { query: q, operator: "and" },
                },
              },
            ],
            filter: [{ term: { is_active: true } }],
          },
        },
        sort: [{ _score: "desc" }, { rating: "desc" }],
      },
    });

    const body = response.body as { hits?: { hits?: OpenSearchHit[] } };
    const suggestions = (body.hits?.hits ?? [])
      .map(toSuggestion)
      .filter((item): item is ProductSuggestion => Boolean(item));

    return {
      data: suggestions,
      meta: {
        backend: "opensearch",
        degraded: false,
        tookMs: Date.now() - started,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "autocomplete failed";
    console.warn(
      "[search] OpenSearch autocomplete unavailable; using PostgreSQL fallback:",
      message
    );
    return autocompleteFromPostgres(q, query.limit, "OpenSearch unavailable");
  }
}

async function autocompleteFromPostgres(
  q: string,
  limit: number,
  reason: string
): Promise<AutocompleteResponse> {
  const started = Date.now();
  const { products } = await listProducts({
    page: 1,
    limit,
    q,
    sort: "relevance",
  });

  return {
    data: products.map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      category: product.category,
      categoryName: product.categoryName,
      price: product.price,
      imageUrl: product.srcUrl,
      stock: product.stock,
    })),
    meta: {
      backend: "postgres",
      degraded: true,
      tookMs: Date.now() - started,
      reason,
    },
  };
}
