import { Router } from "express";
import { asyncHandler, parseInput } from "../../lib/http";
import {
  autocompleteProducts,
  autocompleteQuerySchema,
  searchProducts,
  searchQuerySchema,
} from "./search.service";

const router = Router();

/**
 * GET /api/search
 *
 * Fuzzy, typo-tolerant product search with category, price and availability
 * filters. Data is hydrated from PostgreSQL in OpenSearch rank order, so the
 * response is the same ProductDto shape as GET /api/products.
 */
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const query = parseInput(searchQuerySchema, req.query);
    const result = await searchProducts(query);
    res.status(200).json(result);
  })
);

/**
 * GET /api/search/autocomplete?q=min&limit=8
 *
 * Lightweight title suggestions for the storefront search box.
 */
router.get(
  "/search/autocomplete",
  asyncHandler(async (req, res) => {
    const query = parseInput(autocompleteQuerySchema, req.query);
    const result = await autocompleteProducts(query);
    res.status(200).json(result);
  })
);

export default router;
