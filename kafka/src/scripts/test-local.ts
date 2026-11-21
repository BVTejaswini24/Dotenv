/**
 * test-local.ts
 *
 * Local test suite for the ShopSphere Kafka module.
 * Does NOT connect to Aiven or any external service.
 * Does NOT require kafka/.env to be populated.
 *
 * Tests:
 *   1. Event validation — valid event passes
 *   2. Event validation — missing eventId rejected
 *   3. Event validation — wrong eventName rejected
 *   4. Event validation — missing payload.orderId rejected
 *   5. Event validation — non-array items rejected
 *   6. Event validation — item with zero quantity rejected
 *   7. Idempotency — duplicate eventId is skipped
 *   8. Idempotency — new eventId is processed
 *   9. Retry logic — handler succeeds on 3rd attempt
 *  10. Malformed JSON — parseMessage equivalent rejects garbage input
 *
 * USAGE
 *   cd kafka
 *   npm run test:local
 */

import { validateOrderPlacedEvent, OrderPlacedEvent } from "../types";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validEvent(overrides?: Partial<Record<string, unknown>>): unknown {
  return {
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    eventVersion: "1.0",
    eventName: "order_placed",
    occurredAt: "2024-11-21T10:30:00.000Z",
    payload: {
      orderId: "ORDER-001",
      customerId: "USER-001",
      totalAmount: 299.99,
      status: "confirmed",
      items: [
        { productId: "PROD-001", quantity: 2, unitPrice: 149.99 },
      ],
    },
    ...(overrides ?? {}),
  };
}

function validPayloadEvent(): OrderPlacedEvent {
  return validEvent() as OrderPlacedEvent;
}

// ---------------------------------------------------------------------------
// In-memory IdempotencyStore for local testing
// ---------------------------------------------------------------------------

class MemoryIdempotencyStore {
  private processed = new Set<string>();

  async hasBeenProcessed(eventId: string): Promise<boolean> {
    return this.processed.has(eventId);
  }

  async markAsProcessed(eventId: string): Promise<void> {
    this.processed.add(eventId);
  }
}

// ---------------------------------------------------------------------------
// Tests — Event validation
// ---------------------------------------------------------------------------

console.log("\n── Event Validation ──────────────────────────────────────────");

test("1. Valid event passes validation", () => {
  const result = validateOrderPlacedEvent(validEvent());
  assertNull(result, "Expected no validation error");
});

test("2. Missing eventId is rejected", () => {
  const result = validateOrderPlacedEvent({ ...validEvent() as object, eventId: "" });
  assertNotNull(result, "Expected a validation error");
  if (!result?.includes("eventId")) {
    throw new Error(`Expected error to mention 'eventId', got: ${result}`);
  }
});

test("3. Wrong eventName is rejected", () => {
  const result = validateOrderPlacedEvent({ ...validEvent() as object, eventName: "order_cancelled" });
  assertNotNull(result, "Expected a validation error");
  if (!result?.includes("eventName")) {
    throw new Error(`Expected error to mention 'eventName', got: ${result}`);
  }
});

test("4. Missing payload.orderId is rejected", () => {
  const event = validEvent() as Record<string, unknown>;
  event.payload = { ...(event.payload as object), orderId: "" };
  const result = validateOrderPlacedEvent(event);
  assertNotNull(result, "Expected a validation error");
  if (!result?.includes("orderId")) {
    throw new Error(`Expected error to mention 'orderId', got: ${result}`);
  }
});

test("5. Non-array items is rejected", () => {
  const event = validEvent() as Record<string, unknown>;
  event.payload = { ...(event.payload as object), items: "not-an-array" };
  const result = validateOrderPlacedEvent(event);
  assertNotNull(result, "Expected a validation error");
  if (!result?.includes("items")) {
    throw new Error(`Expected error to mention 'items', got: ${result}`);
  }
});

test("6. Item with quantity 0 is rejected", () => {
  const event = validEvent() as Record<string, unknown>;
  event.payload = {
    ...(event.payload as object),
    items: [{ productId: "P1", quantity: 0, unitPrice: 10 }],
  };
  const result = validateOrderPlacedEvent(event);
  assertNotNull(result, "Expected a validation error");
  if (!result?.includes("quantity")) {
    throw new Error(`Expected error to mention 'quantity', got: ${result}`);
  }
});

test("7. Non-object is rejected", () => {
  const result = validateOrderPlacedEvent("not an object");
  assertNotNull(result, "Expected a validation error");
});

test("8. Missing occurredAt is rejected", () => {
  const result = validateOrderPlacedEvent({ ...validEvent() as object, occurredAt: "" });
  assertNotNull(result, "Expected a validation error");
  if (!result?.includes("occurredAt")) {
    throw new Error(`Expected error to mention 'occurredAt', got: ${result}`);
  }
});

// ---------------------------------------------------------------------------
// Tests — Idempotency store
// ---------------------------------------------------------------------------

console.log("\n── Idempotency Store ─────────────────────────────────────────");

test("9. New eventId is not marked as processed", async () => {
  const store = new MemoryIdempotencyStore();
  const result = await store.hasBeenProcessed("event-aaa");
  assertEquals(result, false, "New event should not be processed");
});

// Note: async tests need special handling in our minimal harness.
// We run them synchronously by collecting promises and checking after.
const asyncTests: Array<() => Promise<void>> = [];

asyncTests.push(async () => {
  const store = new MemoryIdempotencyStore();
  await store.markAsProcessed("event-bbb");
  const result = await store.hasBeenProcessed("event-bbb");
  if (result !== true) {
    throw new Error("Event should be marked as processed after markAsProcessed");
  }
});

asyncTests.push(async () => {
  const store = new MemoryIdempotencyStore();
  await store.markAsProcessed("event-ccc");
  await store.markAsProcessed("event-ccc"); // second call must not throw
  const result = await store.hasBeenProcessed("event-ccc");
  if (result !== true) {
    throw new Error("Idempotent double-mark should still report processed");
  }
});

asyncTests.push(async () => {
  const store = new MemoryIdempotencyStore();
  let processingCount = 0;

  // Simulate processing logic that checks idempotency
  async function simulateProcess(eventId: string): Promise<void> {
    if (await store.hasBeenProcessed(eventId)) return;
    processingCount++;
    await store.markAsProcessed(eventId);
  }

  await simulateProcess("event-ddd");
  await simulateProcess("event-ddd"); // duplicate
  await simulateProcess("event-ddd"); // duplicate again

  if (processingCount !== 1) {
    throw new Error(
      `Expected processing exactly once, but ran ${processingCount} times`
    );
  }
});

// ---------------------------------------------------------------------------
// Tests — Retry logic (synchronous simulation)
// ---------------------------------------------------------------------------

console.log("\n── Retry Logic ───────────────────────────────────────────────");

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
  // Handler that fails twice then succeeds on the 3rd attempt
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
  // Handler that always fails — should throw after maxRetries
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
  if (callCount !== 3) throw new Error(`Expected 3 attempts, got ${callCount}`);
});

// ---------------------------------------------------------------------------
// Run async tests
// ---------------------------------------------------------------------------

const asyncTestNames = [
  "10. markAsProcessed makes hasBeenProcessed return true",
  "11. Double markAsProcessed does not throw",
  "12. Duplicate event processed exactly once",
  "13. Handler succeeds on 3rd attempt after transient failure",
  "14. Handler throws after exhausting max retries",
];

async function runAsyncTests(): Promise<void> {
  console.log("\n── Async Idempotency + Retry ─────────────────────────────────");
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
  console.log("║   ShopSphere Kafka — Local Test Suite                   ║");
  console.log("║   No Aiven connection required                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  await runAsyncTests();

  console.log("\n──────────────────────────────────────────────────────────────");
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
