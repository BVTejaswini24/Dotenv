import { Client } from "@opensearch-project/opensearch";
import { env } from "../../config/env";

/**
 * Lazily-created OpenSearch client for product search.
 *
 * Credentials stay server-side. The frontend never talks to OpenSearch.
 * If OPENSEARCH_* is not configured, isSearchConfigured() is false and the
 * search service degrades to PostgreSQL instead of throwing at boot.
 */

let client: Client | null = null;

export function isSearchConfigured(): boolean {
  return Boolean(
    env.opensearchNode && env.opensearchUsername && env.opensearchPassword
  );
}

export function getSearchClient(): Client {
  if (!isSearchConfigured()) {
    throw new Error("OpenSearch is not configured");
  }
  if (!client) {
    client = new Client({
      node: env.opensearchNode,
      auth: {
        username: env.opensearchUsername,
        password: env.opensearchPassword,
      },
      ssl: { rejectUnauthorized: true },
      requestTimeout: env.opensearchTimeoutMs,
      maxRetries: 1,
    });
  }
  return client;
}

export async function closeSearchClient(): Promise<void> {
  if (client) {
    await client.close().catch(() => undefined);
    client = null;
  }
}
