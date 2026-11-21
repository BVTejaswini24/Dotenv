/**
 * config.ts
 *
 * Reads all required environment variables and exports a typed config object.
 * Fails fast at startup if any required variable is missing, so misconfiguration
 * is caught immediately rather than at the point of first use.
 *
 * Call loadConfig() once at the entry point of the producer or consumer process.
 *
 * AIVEN SASL AUTHENTICATION NOTE
 * --------------------------------
 * This module connects to Aiven Kafka using SASL/SCRAM-SHA-256 over TLS.
 * With SASL authentication, only the CA certificate is required for the TLS
 * layer — client certificate (service.cert) and client key (service.key) are
 * NOT needed and are NOT used. Those files are only required when using
 * certificate-based (mTLS) authentication, which is a separate Aiven auth mode.
 *
 * Reference: https://aiven.io/docs/products/kafka/howto/connect-with-nodejs
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from the kafka/ directory (dev only).
// In production the platform (Aiven, etc.) injects env vars directly.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `[ShopSphere Kafka] Missing required environment variable: ${name}\n` +
        `Copy kafka/.env.example to kafka/.env and fill in all values.`
    );
  }
  return value.trim();
}

export interface KafkaConfig {
  brokers: string[];
  groupId: string;
  ssl: {
    /**
     * CA certificate from Aiven (ca.pem), base64-encoded.
     * This is the only TLS credential needed for SASL authentication.
     * Client certificate and key are NOT required for SASL.
     */
    ca: Buffer;
  };
  sasl: {
    mechanism: "scram-sha-256";
    username: string;
    password: string;
  };
  topics: {
    orderPlaced: string;
  };
}

let _config: KafkaConfig | null = null;

/**
 * Loads and validates all required env vars.
 * Returns the same config object on subsequent calls (singleton).
 * Throws immediately if any variable is missing or empty.
 */
export function loadConfig(): KafkaConfig {
  if (_config) return _config;

  _config = {
    brokers: requireEnv("KAFKA_BROKERS")
      .split(",")
      .map((b) => b.trim()),
    groupId: requireEnv("KAFKA_GROUP_ID"),
    ssl: {
      // Aiven provides a CA certificate (ca.pem) for TLS server verification.
      // It is base64-encoded in the env var so it can be stored as a single line.
      // No client cert or key is needed — SASL username/password handles identity.
      ca: Buffer.from(requireEnv("KAFKA_SSL_CA"), "base64"),
    },
    sasl: {
      mechanism: "scram-sha-256",
      username: requireEnv("KAFKA_SASL_USERNAME"),
      password: requireEnv("KAFKA_SASL_PASSWORD"),
    },
    topics: {
      orderPlaced: requireEnv("KAFKA_TOPIC_ORDER_PLACED"),
    },
  };

  return _config;
}
