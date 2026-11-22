/**
 * topic-map.ts
 *
 * Maps backend event_type strings to Aiven Kafka topic names.
 *
 * Topic names come from environment variables so they can be changed without
 * code changes. Defaults match the agreed contract in EVENT_CONTRACT.md.
 *
 * DLT (dead-letter) topics are derived by appending ".DLT" to the main topic.
 */

import { loadConfig } from "../config";

/**
 * Returns the Kafka topic for a given backend event_type.
 * Throws if the event_type is not in the mapping — this is a programming error
 * and should never reach production.
 */
export function topicForEventType(eventType: string): string {
  const config = loadConfig();

  switch (eventType) {
    case "order.placed":
      return config.topics.orders;
    case "inventory.updated":
      return config.topics.inventory;
    case "product.updated":
      return config.topics.products;
    default:
      throw new Error(
        `[ShopSphere Kafka] No topic mapping for event_type="${eventType}". ` +
          `Supported: order.placed, inventory.updated, product.updated`
      );
  }
}

/**
 * Returns the dead-letter topic for a given main topic name.
 * e.g. "shopsphere.orders" → "shopsphere.orders.DLT"
 */
export function dltTopicFor(topic: string): string {
  return `${topic}.DLT`;
}
