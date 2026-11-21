import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    // The suite shares one real PostgreSQL database; run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
