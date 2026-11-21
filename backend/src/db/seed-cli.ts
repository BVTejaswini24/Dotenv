import { pool } from "./pool";
import { seedCatalog } from "./seed";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await seedCatalog(client);
    await client.query("COMMIT");
    console.log(
      `[seed] categories=${result.categories} products=${result.products} variants=${result.variants} inventory=${result.inventoryRows}`
    );
    console.log("[seed] Idempotent: re-running updates rows instead of duplicating them.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error("[seed] Failed:", error instanceof Error ? error.message : error);
    await pool.end().catch(() => undefined);
    process.exitCode = 1;
  });
