import { Router } from "express";
import { asyncHandler, paginationMeta, parseInput, resolvePagination } from "../../lib/http";
import {
  getProduct,
  listProducts,
  listProductsQuerySchema,
} from "./products.service";

const router = Router();

/**
 * GET /api/products
 * Pagination, category/gender/price filters, sorting and a temporary ILIKE
 * search fallback (OpenSearch will replace `q` later via GET /api/search).
 */
router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const query = parseInput(listProductsQuerySchema, req.query);
    const pagination = resolvePagination(query.page, query.limit);
    const { products, total } = await listProducts(query);

    res.status(200).json({
      data: products,
      pagination: paginationMeta(total, pagination),
    });
  })
);

/** GET /api/products/:idOrSlug — numeric legacy id, UUID, or slug. */
router.get(
  "/products/:idOrSlug",
  asyncHandler(async (req, res) => {
    const product = await getProduct(req.params.idOrSlug);
    res.status(200).json({ data: product });
  })
);

export default router;
