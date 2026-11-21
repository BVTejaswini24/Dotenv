import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors";
import {
  getEligibleProducts,
  runAIVirtualTryOn,
  checkPredictionStatus,
} from "./tryon.service";
import { parseTryOnRequest } from "./tryon.validation";

const router = Router();

/**
 * GET /api/tryon/products
 * Returns all products that qualify for Virtual Try-On
 */
router.get("/products", (_req, res) => {
  const products = getEligibleProducts();
  res.json({
    data: {
      products,
      total: products.length,
    },
  });
});

/**
 * POST /api/tryon
 * Generates an AI virtual try-on image using a real provider.
 *
 * 200 -> completed image
 * 202 -> provider accepted the job but has not finished (poll /status/:id)
 * 422 -> no provider credentials configured (never a simulated image)
 */
router.post("/", async (req, res, next) => {
  try {
    const parsed = parseTryOnRequest(req.body);
    const result = await runAIVirtualTryOn(parsed);

    if (!result.success && result.message === "MISSING_API_KEY") {
      return res.status(422).json({
        error: {
          code: "MISSING_TRYON_API_KEY",
          message:
            "Virtual Try-On AI credentials are not configured in backend/.env.",
          details: result.details,
        },
        fallbackAllowed: false,
      });
    }

    if (!result.success && result.status === "processing") {
      return res.status(202).json({ data: result });
    }

    return res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

const statusQuerySchema = z.object({
  provider: z.enum(["fashn", "replicate", "hf-space", "auto"]).optional(),
});

/**
 * GET /api/tryon/status/:id?provider=fashn|replicate
 * Checks the status of an ongoing prediction.
 */
router.get("/status/:id", async (req, res, next) => {
  try {
    const query = statusQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid provider filter", {
        allowedProviders: ["fashn", "replicate", "hf-space", "auto"],
      });
    }

    const result = await checkPredictionStatus(
      req.params.id,
      query.data.provider ?? "auto"
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
