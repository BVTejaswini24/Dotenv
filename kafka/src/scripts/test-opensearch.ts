/**
 * test-opensearch.ts
 *
 * Standalone connection test script for OpenSearch.
 * Pings the configured OpenSearch service over authenticated HTTPS.
 * Never logs or prints credentials or secrets.
 *
 * USAGE:
 *   cd kafka
 *   npm run test:opensearch
 */

import { getOpenSearchClient, loadOpenSearchConfig } from "../opensearch/client";

async function main(): Promise<void> {
  console.log("------------------------------------------------------------");
  console.log("[ShopSphere OpenSearch] Connection Test — Service Ping");
  console.log("------------------------------------------------------------");

  try {
    const config = loadOpenSearchConfig();
    const url = new URL(config.node);
    console.log(`Target host: ${url.hostname}:${url.port || "443"}`);
    console.log(`Protocol: ${url.protocol}`);
    console.log("TLS Certificate Verification: Enabled (rejectUnauthorized: true)");
    console.log(`Authenticated User: ${config.auth.username}`);

    const client = getOpenSearchClient();
    const response = await client.ping();

    if (response.body === true || response.statusCode === 200) {
      console.log("------------------------------------------------------------");
      console.log("[ShopSphere OpenSearch] Ping SUCCESSFUL: Service is UP and reachable ✓");
      console.log(`Response HTTP Status: ${response.statusCode}`);
      console.log("------------------------------------------------------------");
      process.exit(0);
    } else {
      console.error("[ShopSphere OpenSearch] Ping returned unexpected response:", response.statusCode);
      process.exit(1);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("------------------------------------------------------------");
    console.error("[ShopSphere OpenSearch] Connection test FAILED ✗");
    console.error(`Error: ${errorMsg}`);
    console.error("------------------------------------------------------------");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error in OpenSearch test script:", err);
  process.exit(1);
});

