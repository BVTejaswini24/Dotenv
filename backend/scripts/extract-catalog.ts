/**
 * One-off extractor: copies the frontend's static catalogue into JSON that the
 * backend seed script can consume without depending on Next.js path aliases.
 *
 * Run from backend/:  npm run seed:extract
 */
import fs from "node:fs";
import path from "node:path";
import { categories } from "../../src/lib/data/categories";
import { products } from "../../src/lib/data/products";

const outputPath = path.resolve(__dirname, "../src/data/catalog.json");

const catalog = {
  generatedAt: new Date().toISOString(),
  source: "src/lib/data/products.ts",
  categories,
  products,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

console.log(
  `[seed:extract] wrote ${products.length} products and ${categories.length} categories to ${outputPath}`
);
