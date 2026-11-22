/**
 * src/opensearch/index-setup.ts
 *
 * Index configuration and idempotent setup for ShopSphere OpenSearch.
 *
 * Target index: shopsphere_products
 *
 * Configures:
 *  - Custom text analysis with lowercase and ASCII folding (product_search_analyzer)
 *  - Autocomplete support with edge n-grams (min_gram: 2, max_gram: 15)
 *  - Field mappings reflecting PostgreSQL schema (products, product_variants, categories)
 *    and Kafka event contracts.
 *  - Strict idempotency: checks index existence before creating; never overwrites or deletes.
 */

import { Client } from "@opensearch-project/opensearch";
import { getOpenSearchClient } from "./client";

export const PRODUCT_INDEX_NAME = "shopsphere_products";

export const PRODUCT_INDEX_SETTINGS = {
  index: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
  analysis: {
    filter: {
      autocomplete_filter: {
        type: "edge_ngram",
        min_gram: 2,
        max_gram: 15,
      },
      asciifolding_filter: {
        type: "asciifolding",
        preserve_original: false,
      },
    },
    analyzer: {
      product_search_analyzer: {
        type: "custom",
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding_filter"],
      },
      autocomplete_analyzer: {
        type: "custom",
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding_filter", "autocomplete_filter"],
      },
      autocomplete_search_analyzer: {
        type: "custom",
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding_filter"],
      },
    },
  },
};

export const PRODUCT_INDEX_MAPPINGS = {
  properties: {
    id: { type: "integer" },
    uuid: { type: "keyword" },
    slug: { type: "keyword" },
    title: {
      type: "text",
      analyzer: "product_search_analyzer",
      fields: {
        autocomplete: {
          type: "text",
          analyzer: "autocomplete_analyzer",
          search_analyzer: "autocomplete_search_analyzer",
        },
        keyword: {
          type: "keyword",
          ignore_above: 256,
        },
      },
    },
    description: {
      type: "text",
      analyzer: "product_search_analyzer",
    },
    brand: {
      type: "keyword",
      fields: {
        text: {
          type: "text",
          analyzer: "product_search_analyzer",
        },
      },
    },
    category: { type: "keyword" },
    category_name: {
      type: "keyword",
      fields: {
        text: {
          type: "text",
          analyzer: "product_search_analyzer",
        },
      },
    },
    subcategory: { type: "keyword" },
    gender: { type: "keyword" },
    sku: {
      type: "keyword",
      fields: {
        text: {
          type: "text",
          analyzer: "product_search_analyzer",
        },
      },
    },
    tags: { type: "keyword" },
    price: { type: "float" },
    original_price: { type: "float" },
    discount_percentage: { type: "float" },
    rating: { type: "float" },
    review_count: { type: "integer" },
    stock: { type: "integer" },
    is_new: { type: "boolean" },
    is_featured: { type: "boolean" },
    is_best_seller: { type: "boolean" },
    is_on_sale: { type: "boolean" },
    is_active: { type: "boolean" },
    image_url: { type: "keyword", index: false },
    variants: {
      type: "nested",
      properties: {
        variant_id: { type: "keyword" },
        sku: { type: "keyword" },
        size: { type: "keyword" },
        color: { type: "keyword" },
        price: { type: "float" },
        stock: { type: "integer" },
      },
    },
    created_at: { type: "date" },
    updated_at: { type: "date" },
  },
};

export interface EnsureIndexResult {
  index: string;
  created: boolean;
  alreadyExists: boolean;
}

/**
 * Ensures that the product search index exists in OpenSearch.
 *
 * IDEMPOTENCY:
 * Checks whether the index exists first. If it does, logs a message and returns
 * without modifying or deleting the index. Never recreates or drops existing indices.
 */
export async function ensureProductIndex(
  client?: Client
): Promise<EnsureIndexResult> {
  const opensearch = client ?? getOpenSearchClient();

  const existsResponse = await opensearch.indices.exists({
    index: PRODUCT_INDEX_NAME,
  });

  const exists =
    existsResponse.body === true ||
    existsResponse.statusCode === 200 ||
    Boolean(existsResponse.body);

  if (exists) {
    console.log(
      `[ShopSphere OpenSearch] Index "${PRODUCT_INDEX_NAME}" already exists. Skipping creation.`
    );
    return {
      index: PRODUCT_INDEX_NAME,
      created: false,
      alreadyExists: true,
    };
  }

  console.log(
    `[ShopSphere OpenSearch] Index "${PRODUCT_INDEX_NAME}" not found. Creating index with custom analyzers and mappings...`
  );

  await opensearch.indices.create({
    index: PRODUCT_INDEX_NAME,
    body: {
      settings: PRODUCT_INDEX_SETTINGS as Record<string, any>,
      mappings: PRODUCT_INDEX_MAPPINGS as Record<string, any>,
    },
  });

  // Verify that the index now exists
  const verifyResponse = await opensearch.indices.exists({
    index: PRODUCT_INDEX_NAME,
  });

  const verified =
    verifyResponse.body === true ||
    verifyResponse.statusCode === 200 ||
    Boolean(verifyResponse.body);

  if (!verified) {
    throw new Error(
      `[ShopSphere OpenSearch] Index creation request completed, but verification failed: "${PRODUCT_INDEX_NAME}" not found.`
    );
  }

  console.log(
    `[ShopSphere OpenSearch] Index "${PRODUCT_INDEX_NAME}" created and verified successfully ✓`
  );

  return {
    index: PRODUCT_INDEX_NAME,
    created: true,
    alreadyExists: false,
  };
}
