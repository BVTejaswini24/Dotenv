# ShopSphere Event Contract (Outbox → Kafka)

Owner of the producer side: Member 2 (this backend).
Owner of the relay, Kafka topics and consumers: Member 3.

The backend never talks to Kafka. It writes events to `outbox_events` inside the
same PostgreSQL transaction as the business change. Member 3's relay reads
pending rows and publishes them. This guarantees "no order without event" and
"no event without order".

Event schema version: **1** (`outbox_events.event_version`).

---

## Envelope

Every `payload` is a JSON object with these top-level fields:

| Field | Type | Description |
| --- | --- | --- |
| `event_id` | UUID string | equals `outbox_events.id`; stable across retries |
| `event_type` | string | `order.placed` \| `inventory.updated` \| `product.updated` |
| `event_version` | integer | `1` |
| `occurred_at` | ISO-8601 string | business timestamp (UTC) |

The outbox row also carries `aggregate_type` and `aggregate_id`; use them as the
Kafka message key so events for one order/variant stay ordered.

Suggested topic layout (Member 3 decides the final names):

- `shopsphere.orders` — `order.placed`
- `shopsphere.inventory` — `inventory.updated`
- `shopsphere.products` — `product.updated`

---

## `order.placed`

Written once per successfully committed order, in the order transaction.

```json
{
  "event_id": "9c0b6a2e-6a63-4f0b-9a2e-0e7f4a1d2b3c",
  "event_type": "order.placed",
  "event_version": 1,
  "occurred_at": "2026-11-21T12:00:00.000Z",
  "order": {
    "id": "0b6f4d8e-…",
    "order_number": "SS-20261121-A1B2C3",
    "user_id": "7f1e…",
    "status": "confirmed",
    "currency": "USD",
    "subtotal": 240,
    "discount": 0,
    "delivery_fee": 0,
    "total": 240
  },
  "items": [
    {
      "product_id": 1,
      "product_uuid": "5a2c…",
      "variant_id": "c81d…",
      "sku": "LX-TS-001-S-BROWN",
      "title": "T-shirt with Tape Details",
      "size": "S",
      "color": "Brown",
      "quantity": 2,
      "unit_price": 120,
      "line_total": 240
    }
  ],
  "inventory": [
    { "variant_id": "c81d…", "sku": "LX-TS-001-S-BROWN", "quantity_change": -2 }
  ]
}
```

- `product_id` is the frontend's numeric catalogue id; `product_uuid` is the
  internal UUID (use either to index OpenSearch, but be consistent).
- Money fields are major units (`120` = `$120`).
- `items` is a complete snapshot, so consumers never need to read Postgres to
  process an order (useful for analytics and for the "best seller" ranking).

## `inventory.updated`

Written per order line that changed stock, same transaction as `order.placed`.

```json
{
  "event_id": "…",
  "event_type": "inventory.updated",
  "event_version": 1,
  "occurred_at": "2026-11-21T12:00:00.000Z",
  "order_id": "0b6f4d8e-…",
  "variant_id": "c81d…",
  "product_id": 1,
  "sku": "LX-TS-001-S-BROWN",
  "quantity_change": -2
}
```

`quantity_change` is negative for sales. Absolute stock is authoritative in
`inventory`; consumers that need the new number should read it (or apply the
delta if they only ever see this stream from a known baseline).

## `product.updated`

Reserved for product/admin changes. The type is supported by
`insertOutboxEvent`, but no admin API emits it yet. Planned payload:

```json
{
  "event_id": "…",
  "event_type": "product.updated",
  "event_version": 1,
  "occurred_at": "…",
  "product": {
    "id": 1,
    "uuid": "5a2c…",
    "slug": "t-shirt-with-tape-details",
    "title": "T-shirt with Tape Details",
    "category": "t-shirts",
    "price": 120,
    "stock": 20,
    "is_active": true
  }
}
```

---

## Publishing from the outbox (Member 3)

`src/modules/outbox/outbox.service.ts` exposes:

```ts
import { runOutboxBatch } from "./modules/outbox/outbox.service";

const result = await runOutboxBatch(async (event) => {
  await producer.send({
    topic: topicFor(event.event_type),        // your mapping
    messages: [{
      key: event.aggregate_id,                // per-order / per-variant ordering
      value: JSON.stringify(event.payload),
      headers: {
        "event-id": event.id,
        "event-type": event.event_type,
        "event-version": String(event.event_version),
      },
    }],
  });
}, 50);
// → { published, failed }
```

`runOutboxBatch`:

1. `BEGIN`, `SELECT … FROM outbox_events WHERE status='pending' AND available_at <= now()
   ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED` (safe with several relay
   instances),
2. calls your `publish` per event,
3. marks `status='published', published_at=now()`,
4. on a publish error increments `attempts`, stores `last_error` and schedules a
   retry with exponential backoff (`available_at = now() + 2^attempts` seconds,
   capped at 300),
5. `COMMIT`.

If this is called from a cron/worker loop, run every few seconds. `FOR UPDATE
SKIP LOCKED` means two workers never publish the same pending row at once.
Kafka producer idempotence is still recommended.

## Consumer idempotency

At-least-once delivery is assumed. Every consumer must deduplicate by
`event_id` using the provided table:

```sql
BEGIN;
  INSERT INTO processed_events (consumer, event_id, event_type)
  VALUES ('opensearch-indexer', $1, $2)
  ON CONFLICT (consumer, event_id) DO NOTHING;   -- 0 rows => already handled
  -- apply the side effect only if the insert returned a row
COMMIT;
```

The side effect and the `processed_events` insert must share one transaction
(OpenSearch writes are not transactional, so for OpenSearch use the deterministic
document id: `product_id`/`variant_id`, which makes re-indexing naturally idempotent).

Recommended consumer behaviour:

- `order.placed` → analytics / order feed; ignore for the search index.
- `inventory.updated` → update the indexed `stock` field for `variant_id`
  (fetch current stock from Postgres or maintain a delta).
- `product.updated` → re-index the product document.

## Guarantees and non-goals

- Postgres commits order + stock + event atomically; a rolled-back order writes
  nothing (covered by a test).
- Events are never deleted; `published` rows stay for audit/replay.
- Kafka is not used to reserve stock: the decrement happens in the order
  transaction before the event exists.
- Partitioning/retention/topic creation are Member 3's responsibility.
