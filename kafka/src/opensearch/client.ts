/**
 * src/opensearch/client.ts
 *
 * OpenSearch client configuration for ShopSphere.
 *
 * Connects to Aiven OpenSearch using authenticated HTTPS with TLS
 * certificate verification enabled.
 *
 * Credentials and node URL are read from environment variables:
 *   - OPENSEARCH_NODE
 *   - OPENSEARCH_USERNAME
 *   - OPENSEARCH_PASSWORD
 */

import { Client } from "@opensearch-project/opensearch";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from the kafka/ directory if not already loaded
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `[ShopSphere OpenSearch] Missing required environment variable: ${name}`
    );
  }
  return value.trim();
}

export interface OpenSearchConfig {
  node: string;
  auth: {
    username: string;
    password: string;
  };
}

/**
 * Loads and validates OpenSearch configuration from environment variables.
 * Never logs or exposes password/credentials.
 */
export function loadOpenSearchConfig(): OpenSearchConfig {
  const node = requireEnv("OPENSEARCH_NODE");
  const username = requireEnv("OPENSEARCH_USERNAME");
  const password = requireEnv("OPENSEARCH_PASSWORD");

  return {
    node,
    auth: {
      username,
      password,
    },
  };
}

let _client: Client | null = null;

/**
 * Creates a new OpenSearch Client instance with authenticated HTTPS
 * and TLS certificate verification enabled.
 */
export function createOpenSearchClient(): Client {
  const config = loadOpenSearchConfig();

  return new Client({
    node: config.node,
    auth: {
      username: config.auth.username,
      password: config.auth.password,
    },
    ssl: {
      rejectUnauthorized: true,
    },
  });
}

/**
 * Returns a singleton OpenSearch Client instance.
 */
export function getOpenSearchClient(): Client {
  if (!_client) {
    _client = createOpenSearchClient();
  }
  return _client;
}

