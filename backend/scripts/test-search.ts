/**
 * test-search.ts
 *
 * Live verification of GET /api/search and GET /api/search/autocomplete.
 * Uses the real backend app, Aiven PostgreSQL and Aiven OpenSearch.
 *
 * Read-only: only GET requests are issued.
 *
 * Usage: cd backend && npx tsx scripts/test-search.ts
 */

import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";
import { closeSearchClient } from "../src/modules/search/opensearch.client";

const app = createApp();

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.error(`  FAIL  ${name}`, detail ?? "");
    failed++;
  }
}

async function main(): Promise<void> {
  console.log("\nShopSphere live search API verification\n");

  // --- Empty query: browse parity with /api/products -----------------------
  const browse = await request(app).get("/api/search?limit=5");
  check("empty query returns 200", browse.status === 200, browse.body);
  check("empty query uses PostgreSQL", browse.body.meta?.backend === "postgres");
  check("empty query total is 38", browse.body.pagination?.total === 38);
  check("empty query honours limit", browse.body.data?.length === 5);

  // --- Fuzzy / typo tolerance ---------------------------------------------
  const fuzzy = await request(app).get("/api/search?q=minimalst");
  check("fuzzy query returns 200", fuzzy.status === 200, fuzzy.body);
  check(
    "fuzzy 'minimalst' finds Minimalist Shoulder Bag",
    Array.isArray(fuzzy.body.data) &&
      fuzzy.body.data.some((p: { title: string }) =>
        p.title.includes("Minimalist Shoulder Bag")
      ),
    fuzzy.body.data?.map((p: { title: string }) => p.title)
  );
  check(
    "fuzzy search is served by OpenSearch",
    fuzzy.body.meta?.backend === "opensearch",
    fuzzy.body.meta
  );

  const fuzzyTwo = await request(app).get("/api/search?q=sunglases");
  check(
    "fuzzy 'sunglases' finds Classic Sunglasses",
    fuzzyTwo.body.data?.some((p: { title: string }) =>
      p.title.includes("Classic Sunglasses")
    ),
    fuzzyTwo.body.data?.map((p: { title: string }) => p.title)
  );

  // --- Exact match ranking -------------------------------------------------
  const exact = await request(app).get(
    "/api/search?q=" + encodeURIComponent("Classic Sunglasses")
  );
  check("exact query returns 200", exact.status === 200, exact.body);
  check(
    "exact title ranks first",
    exact.body.data?.[0]?.title === "Classic Sunglasses",
    exact.body.data?.[0]?.title
  );

  // --- Partial name matching ----------------------------------------------
  const partial = await request(app).get("/api/search?q=sungl");
  check(
    "partial 'sungl' finds Classic Sunglasses",
    partial.body.data?.some((p: { title: string }) =>
      p.title.includes("Classic Sunglasses")
    ),
    partial.body.data?.map((p: { title: string }) => p.title)
  );

  // --- Autocomplete --------------------------------------------------------
  const auto = await request(app).get("/api/search/autocomplete?q=minim");
  check("autocomplete returns 200", auto.status === 200, auto.body);
  check(
    "autocomplete 'minim' suggests Minimalist Shoulder Bag",
    auto.body.data?.some((p: { title: string }) =>
      p.title.includes("Minimalist Shoulder Bag")
    ),
    auto.body.data
  );
  check("autocomplete limited to 8 by default", auto.body.data?.length <= 8);

  const autoShort = await request(app).get("/api/search/autocomplete?q=m");
  check(
    "single-character autocomplete returns empty",
    autoShort.status === 200 && autoShort.body.data?.length === 0
  );

  // --- Category filter -----------------------------------------------------
  const category = await request(app).get(
    "/api/search?q=classic&category=accessories&limit=100"
  );
  check("category filter returns 200", category.status === 200, category.body);
  check(
    "all category results are accessories",
    category.body.data?.length > 0 &&
      category.body.data.every(
        (p: { category: string }) => p.category === "accessories"
      ),
    category.body.data?.map((p: { category: string }) => p.category)
  );

  // --- Price filter --------------------------------------------------------
  const price = await request(app).get(
    "/api/search?q=classic&minPrice=50&maxPrice=100&limit=100"
  );
  check("price filter returns 200", price.status === 200, price.body);
  check(
    "all prices are within 50..100",
    price.body.data?.length > 0 &&
      price.body.data.every(
        (p: { price: number }) => p.price >= 50 && p.price <= 100
      ),
    price.body.data?.map((p: { price: number }) => p.price)
  );

  // --- Availability filter -------------------------------------------------
  const available = await request(app).get(
    "/api/search?q=classic&available=true&limit=100"
  );
  check("availability filter returns 200", available.status === 200);
  check(
    "all available results have stock > 0",
    available.body.data?.length > 0 &&
      available.body.data.every((p: { stock: number }) => p.stock > 0),
    available.body.data?.map((p: { stock: number }) => p.stock)
  );

  // --- Response compatibility with /api/products ---------------------------
  const productApi = await request(app).get("/api/products/30");
  const searchHit = await request(app).get("/api/search?q=" + encodeURIComponent("Minimalist Shoulder Bag"));
  const hit = searchHit.body.data?.[0];
  const reference = productApi.body.data;
  check("search result matches product API id", hit?.id === reference?.id);
  check("search result keeps srcUrl", typeof hit?.srcUrl === "string");
  check("search result keeps discount object", typeof hit?.discount?.percentage === "number");
  check("search result keeps sizes array", Array.isArray(hit?.sizes));
  check("search result keeps variants array", Array.isArray(hit?.variants) && hit.variants.length > 0);
  check(
    "search variant fields are intact",
    typeof hit?.variants?.[0]?.id === "string" &&
      typeof hit?.variants?.[0]?.sku === "string" &&
      typeof hit?.variants?.[0]?.price === "number" &&
      typeof hit?.variants?.[0]?.stock === "number",
    hit?.variants?.[0]
  );

  // --- Invalid input -------------------------------------------------------
  const invalid = await request(app).get(
    "/api/search?q=classic&minPrice=200&maxPrice=100"
  );
  check("invalid price range returns 400", invalid.status === 400, invalid.body);

  // --- Data-gap note (no Samsung/iPhone products in this catalogue) --------
  const sams = await request(app).get("/api/search?q=sams");
  check("'sams' request is handled without error", sams.status === 200);
  check(
    "no Samsung products exist in the seeded catalogue (documented data gap)",
    Array.isArray(sams.body.data) && sams.body.data.length === 0,
    sams.body.data?.map((p: { title: string }) => p.title)
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
}

main()
  .catch((error) => {
    console.error("Search test crashed:", error);
    failed++;
  })
  .finally(async () => {
    await closeSearchClient();
    await pool.end().catch(() => undefined);
    process.exit(failed === 0 ? 0 : 1);
  });
