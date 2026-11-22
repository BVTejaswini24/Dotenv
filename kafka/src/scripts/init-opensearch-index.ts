/**
 * init-opensearch-index.ts
 *
 * Initializes the shopsphere_products index in Aiven OpenSearch.
 *
 * - Idempotent: checks if index exists before creating.
 * - Applies custom text analyzers (lowercase, asciifolding, edge_ngram autocomplete).
 * - Maps product fields from PostgreSQL schema.
 * - Never prints credentials or secrets.
 *
 * USAGE:
 *   cd kafka
 *   npm run init:opensearch
 */

import { getOpenSearchClient } from "../opensearch/client";
import { ensureProductIndex, PRODUCT_INDEX_NAME } from "../opensearch/index-setup";

async function main(): Promise<void> {
  console.log("------------------------------------------------------------");
  console.log("[ShopSphere OpenSearch] Initializing Product Index");
  console.log(`Target Index: ${PRODUCT_INDEX_NAME}`);
  console.log("------------------------------------------------------------");

  try {
    const client = getOpenSearchClient();

    // Run idempotent index creation
    const result = await ensureProductIndex(client);

    // Fetch and display cluster confirmation
    const existsResponse = await client.indices.exists({ index: PRODUCT_INDEX_NAME });
    const exists = existsResponse.body === true || existsResponse.statusCode === 200;

    if (!exists) {
      console.error(`[ShopSphere OpenSearch] Verification failed: index "${PRODUCT_INDEX_NAME}" does not exist.`);
      process.exit(1);
    }

    // Fetch index metadata to confirm configuration
    const indexInfo = await client.indices.get({ index: PRODUCT_INDEX_NAME });
    const indexDetails = (indexInfo.body as Record<string, any>)[PRODUCT_INDEX_NAME];
    const propertiesCount = Object.keys(indexDetails?.mappings?.properties ?? {}).length;
    const customAnalyzers = Object.keys(indexDetails?.settings?.index?.analysis?.analyzer ?? {});

    console.log("------------------------------------------------------------");
    console.log("[ShopSphere OpenSearch] Cluster Confirmation:");
    console.log(`  Index Name: ${PRODUCT_INDEX_NAME}`);
    console.log(`  Status: Confirmed Active on Aiven OpenSearch ✓`);
    console.log(`  Action: ${result.alreadyExists ? "Already existed (preserved)" : "Newly created"}`);
    console.log(`  Mapped Properties: ${propertiesCount} fields`);
    console.log(`  Custom Analyzers: ${customAnalyzers.join(", ")}`);
    console.log("------------------------------------------------------------");
    process.exit(0);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("------------------------------------------------------------");
    console.error("[ShopSphere OpenSearch] Index initialization FAILED ✗");
    console.error(`Error: ${errorMsg}`);
    console.error("------------------------------------------------------------");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error in OpenSearch index initialization:", err);
  process.exit(1);
});

