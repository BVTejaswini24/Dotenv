import { Router } from "express";
import { asyncHandler } from "../../lib/http";
import { listCategories } from "../products/products.service";

const router = Router();

/** GET /api/categories */
router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await listCategories();
    res.status(200).json({ data: categories });
  })
);

export default router;
