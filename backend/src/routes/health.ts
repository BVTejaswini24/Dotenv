import { Router } from "express";
import { pool } from "../db/pool";

const router = Router();

/**
 * GET /api/health
 *
 * Returns 200 only when the API is running AND PostgreSQL answers a query.
 * Returns 503 when the database cannot be reached.
 */
router.get("/health", async (_req, res) => {
  const startedAt = Date.now();

  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ok",
      service: "shopsphere-backend",
      database: "connected",
      databaseLatencyMs: Date.now() - startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health] PostgreSQL check failed:", error);

    res.status(503).json({
      status: "error",
      service: "shopsphere-backend",
      database: "unavailable",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
