/**
 * types.ts
 *
 * Canonical TypeScript types for all Kafka events in the ShopSphere platform.
 *
 * These types are derived from the confirmed backend event contract:
 *   backend/EVENT_CONTRACT.md
 *   backend/src/modules/outbox/outbox.service.ts
 *
 * All payload fields use snake_case to match the backend exactly.
 * Do not convert to camelCase — consumers receive payloads as written by the backend.
 *
 * VERSIONING POLICY
 * -----------------
 * - event_version is an integer (1, 2, …) set by the backend.
 * - Bump on breaking payload changes. Coordinate with both teammates.
 */

// ---------------------------------------------------------------------------
// Outbox event row — shape returned by runOutboxBatch()
// Mirrors OutboxEventRow in backend/src/modules/outbox/outbox.service.ts
// ---------------------------------------------------------------------------

export interface OutboxEventRow {
  id: string;               // UUID — also the event_id inside payload
  event_type: string;       // "order.placed" | "inventory.updated" | "product.updated"
  aggregate_type: string;   // "order" | "product" | "product_variant"
  aggregate_id: string;     // UUID — used as the Kafka message key
  event_version: number;    // 1
  payload: Record<string, unknown>; // JSON payload as written by backend
  attempts: number;
}

// ---------------------------------------------------------------------------
// Topic mapping
// ---------------------------------------------------------------------------

export type KafkaTopic =
  | "shopsphere.orders"
  | "shopsphere.inventory"
  | "shopsphere.products";

export const TOPIC_MAP: Record<string, KafkaTopic> = {
  "order.placed":      "shopsphere.orders",
  "inventory.updated": "shopsphere.inventory",
  "product.updated":   "shopsphere.products",
};

export const DLT_SUFFIX = ".DLT";

// ---------------------------------------------------------------------------
// Confirmed payload types (from EVENT_CONTRACT.md + orders.service.ts)
// All fields are snake_case, matching the backend exactly.
// ---------------------------------------------------------------------------

export interface OrderPlacedPayload {
  event_id:      string;   // UUID — same as outbox_events.id
  event_type:    "order.placed";
  event_version: 1;
  occurred_at:   string;   // ISO 8601

  order: {
    id:            string;  // UUID
    order_number:  string;  // "SS-YYYYMMDD-XXXXXX"
    user_id:       string | null;
    status:        string;  // "confirmed"
    currency:      string;  // "USD"
    subtotal:      number;  // major units, e.g. 240
    discount:      number;
    delivery_fee:  number;
    total:         number;
  };

  items: Array<{
    product_id:   number;        // legacy numeric id (frontend catalogue id)
    product_uuid: string;        // internal UUID
    variant_id:   string;        // UUID
    sku:          string;
    title:        string;
    size:         string;
    color:        string;
    quantity:     number;
    unit_price:   number;        // major units
    line_total:   number;        // major units
  }>;

  inventory: Array<{
    variant_id:      string;     // UUID
    sku:             string;
    quantity_change: number;     // negative for sales
  }>;

  // Compatibility fields for legacy producer test scripts
  orderId?: string;
  customerId?: string;
  totalAmount?: number;
  status?: string;
}

export interface InventoryUpdatedPayload {
  event_id:        string;
  event_type:      "inventory.updated";
  event_version:   1;
  occurred_at:     string;
  order_id:        string;       // UUID
  variant_id:      string;       // UUID
  product_id:      number;       // legacy numeric id
  sku:             string;
  quantity_change: number;       // negative for sales
}

export interface ProductUpdatedPayload {
  event_id:      string;
  event_type:    "product.updated";
  event_version: 1;
  occurred_at:   string;
  product: {
    id:        number;           // legacy numeric id
    uuid:      string;           // internal UUID
    slug:      string;
    title:     string;
    category:  string;
    price:     number;           // major units
    stock:     number;
    is_active: boolean;
  };
}

export type ShopSpherePayload =
  | OrderPlacedPayload
  | InventoryUpdatedPayload
  | ProductUpdatedPayload;

/**
 * Envelope wrapper used by order-producer.ts for standalone publishing.
 */
export interface OrderPlacedEvent {
  eventId: string;
  eventVersion: string;
  eventName: string;
  occurredAt: string;
  payload: OrderPlacedPayload;
}

// ---------------------------------------------------------------------------
// Runtime payload validation
// Validates the minimum required shape of an outbox payload before processing.
// Returns a description of the first problem found, or null if valid.
// ---------------------------------------------------------------------------

export function validateOutboxPayload(
  eventType: string,
  raw: unknown
): string | null {
  if (typeof raw !== "object" || raw === null) {
    return "Payload is not an object";
  }

  const p = raw as Record<string, unknown>;

  if (typeof p.event_id !== "string" || p.event_id.trim() === "") {
    return "payload.event_id is missing or empty";
  }
  if (typeof p.event_type !== "string" || p.event_type.trim() === "") {
    return "payload.event_type is missing or empty";
  }
  if (typeof p.event_version !== "number") {
    return "payload.event_version is not a number";
  }
  if (typeof p.occurred_at !== "string" || p.occurred_at.trim() === "") {
    return "payload.occurred_at is missing or empty";
  }

  if (eventType === "order.placed") {
    if (typeof p.order !== "object" || p.order === null) {
      return "payload.order is missing for order.placed";
    }
    const o = p.order as Record<string, unknown>;
    if (typeof o.id !== "string" || o.id.trim() === "") {
      return "payload.order.id is missing";
    }
    if (!Array.isArray(p.items)) {
      return "payload.items must be an array for order.placed";
    }
    if (!Array.isArray(p.inventory)) {
      return "payload.inventory must be an array for order.placed";
    }
  }

  if (eventType === "inventory.updated") {
    if (typeof p.variant_id !== "string" || p.variant_id.trim() === "") {
      return "payload.variant_id is missing for inventory.updated";
    }
    if (typeof p.quantity_change !== "number") {
      return "payload.quantity_change is not a number for inventory.updated";
    }
  }

  return null; // valid
}

/**
 * Validates an order.placed event payload.
 */
export function validateOrderPlacedEvent(payload: unknown): string | null {
  return validateOutboxPayload("order.placed", payload);
}
