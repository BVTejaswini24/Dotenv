import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import authRouter from "./modules/auth/auth.routes";
import cartRouter from "./modules/cart/cart.routes";
import categoriesRouter from "./modules/categories/categories.routes";
import ordersRouter from "./modules/orders/orders.routes";
import productsRouter from "./modules/products/products.routes";
import tryonRouter from "./modules/tryon/tryon.routes";
import healthRouter from "./routes/health";

export function createApp() {
  const app = express();

  if (env.isProduction) {
    // Needed for correct client IPs behind a reverse proxy (rate limiting).
    app.set("trust proxy", 1);
  }

  const allowedOrigins = env.corsOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    })
  );
  app.use(cookieParser());

  // Virtual try-on accepts two base64 images (up to 5 MB each). That is the
  // only endpoint allowed a large body; everything else stays at 1 MB.
  app.use("/api/tryon", express.json({ limit: "16mb" }));
  app.use("/api/tryon", tryonRouter);
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({
      service: "shopsphere-backend",
      health: "/api/health",
      products: "/api/products",
      tryon: "/api/tryon/products",
    });
  });

  app.use("/api", healthRouter);
  app.use("/api", productsRouter);
  app.use("/api", categoriesRouter);
  app.use("/api", authRouter);
  app.use("/api", cartRouter);
  app.use("/api", ordersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
