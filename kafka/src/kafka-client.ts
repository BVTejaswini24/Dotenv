/**
 * kafka-client.ts
 *
 * Creates and exports the shared KafkaJS Kafka instance.
 * This module does NOT open a connection — it only configures the client.
 * Actual connections are made when a producer connects or a consumer subscribes.
 *
 * SSL and SASL settings come entirely from environment variables via config.ts.
 * No credentials are hardcoded here.
 *
 * AIVEN SASL + TLS CONFIGURATION
 * --------------------------------
 * For SASL authentication, Aiven requires:
 *   - ssl.ca   : the Aiven project CA certificate, to verify the broker's TLS identity.
 *   - sasl     : SCRAM-SHA-256 username + password, for client identity.
 *
 * Client certificate (ssl.cert) and client key (ssl.key) are NOT passed here.
 * Those are only required for Aiven's separate certificate-based (mTLS) auth mode.
 *
 * KafkaJS compatibility: KafkaJS is a pure JavaScript Kafka client with no
 * dependency on librdkafka. It is unaffected by the librdkafka SCRAM-SHA-256
 * compatibility note for Apache Kafka 4.x.
 */

import { Kafka, logLevel } from "kafkajs";
import { loadConfig } from "./config";

/**
 * Returns a configured KafkaJS Kafka instance ready for Aiven Kafka.
 * Call this once per process; reuse the returned instance for both
 * producers and consumers in the same process.
 *
 * NOTE: Does not attempt to connect to Aiven until .connect() is called
 * on a producer or consumer derived from this instance.
 * Credentials must be present in the environment before calling this.
 */
export function createKafkaClient(): Kafka {
  const config = loadConfig();

  return new Kafka({
    clientId: "shopsphere-kafka-module",
    brokers: config.brokers,
    // TLS: provide only the CA certificate to verify the Aiven broker.
    // No client cert or key — identity is proven via SASL below.
    ssl: {
      ca: [config.ssl.ca],
    },
    sasl: config.sasl,
    // Map KafkaJS log levels to Node console.
    // INFO in production; set to DEBUG for local troubleshooting.
    logLevel: logLevel.INFO,
  });
}
