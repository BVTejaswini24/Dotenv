import { createApp } from "./app";
import { env } from "./config/env";
import { pool } from "./db/pool";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(
    `[server] ShopSphere backend listening on http://localhost:${env.port}`
  );
  console.log(
    `[server] Health check: http://localhost:${env.port}/api/health`
  );
});

async function shutdown(signal: string) {
  console.log(`[server] ${signal} received. Shutting down...`);

  server.close(async () => {
    try {
      await pool.end();
    } catch (error) {
      console.error("[server] Error while closing PostgreSQL pool:", error);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[server] Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled promise rejection:", reason);
});
