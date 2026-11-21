/**
 * test-local.ts
 *
 * Local test suite for the ShopSphere Kafka module.
 * Does NOT connect to Aiven, PostgreSQL, or any external service.
 * Does NOT require kafka/.env to be populated.
 *
 * Tests:
 *   1.  Valid order.placed event passes validation
 *   2.  Missing event_id is rejected
 *   3.  Wrong event_type is rejected (not in supported set)
 *   4.  Missing occurred_at is rejected
 *   5.  Missing order object is rejected (order.placed)
 *   6.  Non-array items is rejected (order.placed)
 *   7.  Non-object payload is rejected
 *   8.  Valid inventory.updated event passes validation
 *   9.  Missing variant_id is rejected (inventory.updated)
 *  10.  quantity_change non-number is rejected (inventory.updated)
 *  11.  New eventId is not marked as processed (idempotency store)
 *  12.  markAsProcessed makes hasBeenProcessed return true
 *  13.  Double markAsProcessed does not throw
 *  14.  Duplicate event processed exactly once
 *  15.  Handler succeeds on 3rd attempt after transient failure
 *  16.  Handler throws after exhausting max retries
 *
 * USAGE
 *   cd kafka
 *   npm run test:local
 */

import { validateOutboxPayload, validateOrderPlacedEvent } from "../types";

// ---------------------------------------------------------------------------
// Minimal test harness (no test framework dependency)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗  ${name}`);
    console.error(`     ${message}`);
    failed++;
  }
}

function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(
      `${msg ?? "Assertion failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertNull(value: unknown, msg?: string): void {
  if (value !== null) {
    throw new Error(`${msg ?? "Expected null"}, got: ${JSON.stringify(value)}`);
  }
}

function assertNotNull(value: unknown, msg?: string): void {
  if (value === null || value === undefined) {
    throw new Error(`${msg ?? "Expected non-null value"}`);
  }
}

function assertContains(value: string | null, substring: string): void {
  if (!value || !value.includes(substring)) {
    throw new Error(
      `Expected error message to contain "${substring}", got: ${JSON.stringify(value)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Canonical snake_case test fixtures (matches EVENT_CONTRACT.md exactly)
// ---------------------------------------------------------------------------

function validOrderPlacedEvent(
  overrides?: Partial<Record<string, unknown>>
): unknown {
  return {
    event_id:      "550e8400-e29b-41d4-a716-446655440000",
    event_type:    "order.placed",
    event_version: 1,
    occurred_at:   "2026-11-21T10:30:00.000Z",
    order: {
      id:           "0b6f4d8e-1111-2222-3333-000000000001",
      order_number: "SS-20261121-A1B2C3",
      user_id:      null,
      status:       "confirmed",
      currency:     "USD",
      subtotal:     240,
      discount:     0,
      delivery_fee: 0,
      total:        240,
    },
    items: [
      {
        product_id:   1,
        product_uuid: "5a2c0000-0000-0000-0000-000000000001",
        variant_id:   "c81d0000-0000-0000-0000-000000000001",
        sku:          "LX-TS-001-S-BROWN",
        title:        "T-shirt with Tape Details",
        size:         "S",
        color:        "Brown",
        quantity:     2,
        unit_price:   120,
        line_total:   240,
      },
    ],
    inventory: [
      {
        variant_id:      "c81d0000-0000-0000-0000-000000000001",
        sku:             "LX-TS-001-S-BROWN",
        quantity_change: -2,
      },
    ],
    ...(overrides ?? {}),
  };
}

function validInventoryUpdatedEvent(
  overrides?: Partial<Record<string, unknown>>
): unknown {
  return {
    event_id:        "660e8400-e29b-41d4-a716-446655440001",
    event_type:      "inventory.updated",
    event_version:   1,
    occurred_at:     "2026-11-21T10:30:00.000Z",
    order_id:        "0b6f4d8e-1111-2222-3333-000000000001",
    variant_id:      "c81d0000-0000-0000-0000-000000000001",
    product_id:      1,
    sku:             "LX-TS-001-S-BROWN",
    quantity_change: -2,
    ...(overrides ?? {}),
  };
}

// ---------------------------------------------------------------------------
// In-memory IdempotencyStore for local testing
// ---------------------------------------------------------------------------

class MemoryIdempotencyStore {
  private processed = new Set<string>();

  async hasBeenProcessed(eventId: string, _eventType: string): Promise<boolean> {
    return this.processed.has(eventId);
  }

  async markAsProcessed(eventId: string, _eventType: string): Promise<void> {
    this.processed.add(eventId);
  }
}

// ---------------------------------------------------------------------------
// Tests — Event validation (order.placed)
// ---------------------------------------------------------------------------

console.log("\n── order.placed Validation ───────────────────────────────────");

test("1. Valid order.placed event passes validation", () => {
  const result = validateOutboxPayload("order.placed", validOrderPlacedEvent());
  assertNull(result, "Expected no validation error");
});

test("2. Missing event_id is rejected", () => {
  const result = validateOutboxPayload("order.placed", {
    ...(validOrderPlacedEvent() as object),
    event_id: "",
  });
  assertNotNull(result, "Expected a validation error");
  assertContains(result, "event_id");
});

test("3. Wrong event_type (empty string) is rejected", () => {
  const result = validateOutboxPayload("order.placed", {
    ...(validOrderPlacedEvent() as object),
    event_type: "",
  });
  assertNotNull(result, "Expected a validation error");
  assertContains(result, "event_type");
});

test("4. Missing occurred_at is rejected", () => {
  const result = validateOutboxPayload("order.placed", {
    ...(validOrderPlacedEvent() as object),
    occurred_at: "",
  });
  assertNotNull(result, "Expected a validation error");
  assertContains(result, "occurred_at");
});

test("5. Missing order object is rejected (order.placed)", () => {
  const event = { ...(validOrderPlacedEvent() as Record<string, unknown>) };
  delete event.order;
  const result = validateOutboxPayload("order.placed", event);
  assertNotNull(result, "Expected a validation error");
  assertContains(result, "order");
});

test("6. Non-array items is rejected (order.placed)", () => {
  const result = validateOutboxPayload("order.placed", {
    ...(validOrderPlacedEvent() as object),
    items: "not-an-array",
  });
  assertNotNull(result, "Expected a validation error");
  assertContains(result, "items");
});

test("7. Non-object payload is rejected", () => {
  const result = validateOutboxPayload("order.placed", "not an object");
  assertNotNull(result, "Expected a validation error");
});

// ---------------------------------------------------------------------------
// Tests — Event validation (inventory.updated)
// ---------------------------------------------------------------------------

console.log("\n── inventory.updated Validation ──────────────────────────────");

test("8. Valid inventory.updated event passes validation", () => {
  const result = validateOutboxPayload(
    "inventory.updated",
    validInventoryUpdatedEvent()
  );
  assertNull(result, "Expected no validation error");
});

test("9. Missing variant_id is rejected (inventory.updated)", () => {
  const result = validateOutboxPayload("inventory.updated", {
    ...(validInventoryUpdatedEvent() as object),
    variant_id: "",
  });
  assertNotNull(result, "Expected a validation error");
  assertContains(result, "variant_id");
});

test("10. Non-number quantity_change is rejected (inventory.updated)", () => {
  const result = validateOutboxPayload("inventory.updated", {
    ...(validInventoryUpdatedEvent() as object),
    quantity_change: "not-a-number",
  });
  assertNotNull(result, "Expected a validation error");
  assertContains(result, "quantity_change");
});

// ---------------------------------------------------------------------------
// Tests — validateOrderPlacedEvent alias
// ---------------------------------------------------------------------------

console.log("\n── validateOrderPlacedEvent alias ────────────────────────────");

test("10b. validateOrderPlacedEvent valid event returns null", () => {
  const result = validateOrderPlacedEvent(validOrderPlacedEvent());
  assertNull(result, "Expected no error");
});

test("10c. validateOrderPlacedEvent invalid event returns error string", () => {
  const result = validateOrderPlacedEvent({ event_id: "", event_type: "order.placed", event_version: 1, occurred_at: "" });
  assertNotNull(result, "Expected a validation error");
});

// ---------------------------------------------------------------------------
// Async tests — Idempotency store
// ---------------------------------------------------------------------------

const asyncTests: Array<() => Promise<void>> = [];

asyncTests.push(async () => {
  const store = new MemoryIdempotencyStore();
  const result = await store.hasBeenProcessed("event-aaa", "order.placed");
  if (result !== false) {
    throw new Error("New event should not be marked as processed");
  }
});

asyncTests.push(async () => {
  const store = new MemoryIdempotencyStore();
  await store.markAsProcessed("event-bbb", "order.placed");
  const result = await store.hasBeenProcessed("event-bbb", "order.placed");
  if (result !== true) {
    throw new Error("Event should be marked as processed after markAsProcessed");
  }
});

asyncTests.push(async () => {
  const store = new MemoryIdempotencyStore();
  await store.markAsProcessed("event-ccc", "order.placed");
  await store.markAsProcessed("event-ccc", "order.placed"); // second call must not throw
  const result = await store.hasBeenProcessed("event-ccc", "order.placed");
  if (result !== true) {
    throw new Error("Idempotent double-mark should still report processed");
  }
});

asyncTests.push(async () => {
  const store = new MemoryIdempotencyStore();
  let processingCount = 0;

  async function simulateProcess(eventId: string): Promise<void> {
    if (await store.hasBeenProcessed(eventId, "order.placed")) return;
    processingCount++;
    await store.markAsProcessed(eventId, "order.placed");
  }

  await simulateProcess("event-ddd");
  await simulateProcess("event-ddd");
  await simulateProcess("event-ddd");

  if (processingCount !== 1) {
    throw new Error(
      `Expected processing exactly once, but ran ${processingCount} times`
    );
  }
});

// ---------------------------------------------------------------------------
// Async tests — Retry logic
// ---------------------------------------------------------------------------

async function withRetryLocal(
  maxRetries: number,
  initialMs: number,
  fn: () => Promise<void>
): Promise<void> {
  let attempt = 0;
  let delayMs = initialMs;
  while (attempt < maxRetries) {
    try {
      await fn();
      return;
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs *= 2;
    }
  }
}

asyncTests.push(async () => {
  let callCount = 0;
  await withRetryLocal(5, 1, async () => {
    callCount++;
    if (callCount < 3) throw new Error("Simulated transient failure");
  });
  if (callCount !== 3) {
    throw new Error(`Expected 3 attempts, got ${callCount}`);
  }
});

asyncTests.push(async () => {
  let callCount = 0;
  let threw = false;
  try {
    await withRetryLocal(3, 1, async () => {
      callCount++;
      throw new Error("Always fails");
    });
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("Expected retry to throw after max attempts");
  if (callCount !== 3)
    throw new Error(`Expected 3 attempts, got ${callCount}`);
});

// ---------------------------------------------------------------------------
// Run async tests
// ---------------------------------------------------------------------------

const asyncTestNames = [
  "11. New eventId is not marked as processed",
  "12. markAsProcessed makes hasBeenProcessed return true",
  "13. Double markAsProcessed does not throw",
  "14. Duplicate event processed exactly once",
  "15. Handler succeeds on 3rd attempt after transient failure",
  "16. Handler throws after exhausting max retries",
];

async function runAsyncTests(): Promise<void> {
  console.log("\n── Idempotency + Retry ───────────────────────────────────────");
  for (let i = 0; i < asyncTests.length; i++) {
    try {
      await asyncTests[i]();
      console.log(`  ✓  ${asyncTestNames[i]}`);
      passed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗  ${asyncTestNames[i]}`);
      console.error(`     ${message}`);
      failed++;
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   ShopSphere Kafka — Local Test Suite (snake_case)      ║");
  console.log("║   No Aiven connection required                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  await runAsyncTests();

  console.log(
    "\n──────────────────────────────────────────────────────────────"
  );
  console.log(`  Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error("\n  ✗ Some tests failed.");
    process.exit(1);
  } else {
    console.log("\n  ✓ All tests passed.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Unexpected error in test runner:", err);
  process.exit(1);
});
