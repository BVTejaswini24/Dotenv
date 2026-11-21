# ShopSphere — Kafka Module

**Team Dotenv | Garden City University Hackathon**  
Owner: Kafka integration (producer, consumer, event handling)  
Aiven service: `dotenv-kafka` (Apache Kafka 4.3)  
Broker: `dotenv-kafka-sweenydza-5eb5.f.aivencloud.com:24107`

---

## What this module does

- Publishes `order_placed` events to Aiven Kafka after the Express backend commits an order to PostgreSQL.
- Consumes `order_placed` events asynchronously and dispatches them to downstream handlers.
- Provides a stub handler for OpenSearch indexing (Teammate 2 fills in the implementation).
- Defines clear integration interfaces for the backend teammate (idempotency store, outbox relay) and the OpenSearch teammate (adapter).

---

## Directory structure

```
kafka/
├── package.json
├── tsconfig.json
├── .env.example          ← copy to .env and fill in values (never commit .env)
├── README.md
└── src/
    ├── config.ts                          ← validates env vars at startup
    ├── kafka-client.ts                    ← shared KafkaJS instance (Aiven SASL + TLS)
    ├── types.ts                           ← OrderPlacedEvent and EventEnvelope types
    ├── producer/
    │   └── order-producer.ts              ← publishOrderPlaced()
    ├── consumer/
    │   ├── order-consumer.ts              ← startOrderConsumer()
    │   └── handlers/
    │       └── search-sync.handler.ts     ← OpenSearch stub
    └── scripts/
        ├── test-producer.ts               ← Aiven connectivity test: publish one message
        └── test-consumer.ts               ← Aiven connectivity test: receive messages
```

---

## Authentication

This module uses **SASL/SCRAM-SHA-256 over TLS**.

| Credential | Required | Source |
|---|---|---|
| CA certificate (`ca.pem`) | ✅ | Aiven console download |
| Client certificate (`service.cert`) | ❌ Not needed | Only for mTLS mode |
| Client key (`service.key`) | ❌ Not needed | Only for mTLS mode |
| SASL username | ✅ | Aiven console |
| SASL password | ✅ | Aiven console |

With SASL authentication the TLS layer uses the CA certificate only to verify the broker's identity. Your own identity is proven by the SASL username and password. Client cert and key are only required if you switch to Aiven's separate certificate-based (mTLS) authentication mode, which you have not selected.

---

## Setup — step by step

### Step 1: Install dependencies

```powershell
cd kafka
npm install
```

### Step 2: Create your local `.env` file

```powershell
cd kafka
copy .env.example .env
```

`kafka/.env` is listed in the root `.gitignore` and will never be committed.

### Step 3: Get the CA certificate from Aiven

1. Open [console.aiven.io](https://console.aiven.io/) and select the **dotenv-kafka** service.
2. On the **Overview** page, find the **Connection information** section.
3. Click the **SASL** tab (not the Certificate tab).
4. Click **Download CA certificate**. This saves `ca.pem` to your machine.

### Step 4: Base64-encode the CA certificate

The CA certificate must be stored as a single-line base64 string in `.env`.

**Windows PowerShell:**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\ca.pem")) | clip
```
This copies the encoded string directly to your clipboard. Paste it as the value of `KAFKA_SSL_CA` in `kafka/.env`.

**Linux / macOS:**
```bash
base64 -w 0 ca.pem | pbcopy   # macOS (pbcopy copies to clipboard)
base64 -w 0 ca.pem             # Linux — copy the output manually
```

The result is one long line of characters with no line breaks. It looks like:
```
LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t...
```

### Step 5: Get the SASL password

1. In the Aiven console, go to **dotenv-kafka** → **Users** tab.
2. Find the **avnadmin** user.
3. Click **Show password** (or **Reset password** if you have not saved it).
4. Copy the password into `KAFKA_SASL_PASSWORD` in `kafka/.env`.

### Step 6: Create the Kafka topic

The topic must exist in Aiven before you connect. The producer will not auto-create it.

1. In the Aiven console, go to **dotenv-kafka** → **Topics** tab.
2. Click **Create topic**.
3. Enter the name `order_placed`.
4. Accept the defaults (partitions: 1 is fine for a hackathon).
5. Click **Create topic**.

### Step 7: Verify your `.env` file

Your completed `kafka/.env` should look like this (password and CA shown as placeholders):

```dotenv
KAFKA_BROKERS=dotenv-kafka-sweenydza-5eb5.f.aivencloud.com:24107
KAFKA_GROUP_ID=shopsphere-order-consumer
KAFKA_SSL_CA=LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t...   ← long base64 string, no spaces
KAFKA_SASL_USERNAME=avnadmin
KAFKA_SASL_PASSWORD=your-password-here
KAFKA_TOPIC_ORDER_PLACED=order_placed
```

### Step 8: Type-check

```powershell
cd kafka
npm run typecheck
```

Expected output: nothing (exit code 0 means no errors).

### Step 9: Test the connection

**Terminal 1 — start the consumer first:**
```powershell
cd kafka
npm run test:consumer
```
Expected output:
```
[ShopSphere Kafka] Consumer connected | groupId=shopsphere-order-consumer
[ShopSphere Kafka] Subscribed to topic: order_placed
[ShopSphere Kafka] TEST CONSUMER: waiting for messages (Ctrl+C to stop)...
```

**Terminal 2 — send one test message:**
```powershell
cd kafka
npm run test:producer
```
Expected output:
```
[ShopSphere Kafka] Producer connected to Aiven.
[ShopSphere Kafka] Published order_placed | orderId=TEST-ORDER-001 | eventId=... | partition=0 | offset=0
[ShopSphere Kafka] TEST PRODUCER: message confirmed by broker. Partition=0 Offset=0
[ShopSphere Kafka] TEST PRODUCER: PASSED ✓
[ShopSphere Kafka] Producer disconnected.
```

The consumer terminal should then print the received event JSON. Press `Ctrl+C` to stop the consumer cleanly.

---

## Environment variables reference

| Variable | Required | Pre-filled | Description |
|---|---|---|---|
| `KAFKA_BROKERS` | ✅ | ✅ | Aiven broker `host:port` (SASL port) |
| `KAFKA_GROUP_ID` | ✅ | ✅ | Consumer group name |
| `KAFKA_SSL_CA` | ✅ | ❌ | Base64-encoded `ca.pem` from Aiven |
| `KAFKA_SASL_USERNAME` | ✅ | ✅ | Aiven service username (`avnadmin`) |
| `KAFKA_SASL_PASSWORD` | ✅ | ❌ | Aiven service password |
| `KAFKA_TOPIC_ORDER_PLACED` | ✅ | ✅ | Topic name (default: `order_placed`) |

---

## Event contract — `order_placed`

```typescript
{
  eventId: string;         // UUID v4 — idempotency key (Kafka module owns this)
  eventVersion: "1.0";     // bump on breaking schema changes
  eventName: "order_placed";
  occurredAt: string;      // ISO 8601 — when the order was committed to DB
                           // sourced from the backend, NOT the publish timestamp

  payload: {
    orderId: string;       // ⚠️ PROVISIONAL — confirm type with backend teammate
    customerId: string;    // ⚠️ PROVISIONAL — confirm field name and type
    totalAmount: number;   // ⚠️ PROVISIONAL — confirm unit (cents or decimal)
    status: string;        // ⚠️ PROVISIONAL — confirm initial status value
    items: Array<{
      productId: string;   // ⚠️ PROVISIONAL
      quantity: number;    // ⚠️ PROVISIONAL
      unitPrice: number;   // ⚠️ PROVISIONAL — confirm unit
    }>;
  };
}
```

**Kafka message key:** `payload.orderId` — routes all events for the same order to the same partition.

---

## Integration points

### Backend teammate (Express + PostgreSQL)

| # | What we need | Why |
|---|---|---|
| 1 | Confirm all `⚠️ PROVISIONAL` payload fields in `src/types.ts` | Producer and consumer cannot be fully typed without this |
| 2 | Agree on `occurredAt` — use the DB commit timestamp, not `new Date()` at publish time | Accurate event timeline |
| 3 | Transactional outbox table: `outbox(id, event_name, payload JSONB, published_at TIMESTAMPTZ NULL)` | Guarantees publish-after-commit; prevents lost events |
| 4 | Outbox relay: a loop that reads unpublished rows, calls `publishOrderPlaced()`, then marks them published | Owned by backend; this module provides `publishOrderPlaced()` |
| 5 | `processed_events(event_id TEXT PRIMARY KEY, processed_at TIMESTAMPTZ)` table | Durable idempotency; in-memory is not acceptable |
| 6 | Provide a concrete `IdempotencyStore` implementation (from `src/consumer/order-consumer.ts`) | Consumer cannot safely record processed events without it |
| 7 | Confirm whether non-idempotent handlers need to share a DB transaction with `markAsProcessed()` | Atomicity guarantee for exactly-once-effect semantics |

### OpenSearch teammate (Teammate 2)

| # | What we need | Why |
|---|---|---|
| 1 | Aiven OpenSearch endpoint URL | Add to env as `OPENSEARCH_URL` |
| 2 | Index name for orders | Add to env as `OPENSEARCH_INDEX_ORDERS` |
| 3 | Authentication method (API key or basic auth) | Configure the client |
| 4 | Document mapping for an order document | Type the upsert call |
| 5 | Preferred OpenSearch client package | Install inside `kafka/` |
| 6 | Provide a concrete `OpenSearchAdapter` implementation (from `src/consumer/handlers/search-sync.handler.ts`) | Handler is a stub until this is delivered |

---

## Retry and dead-letter strategy

- Each handler retries up to **5 times** with exponential backoff (starting at 300 ms).
- A failed event is **never silently acknowledged**.
- If all retries are exhausted the consumer logs the full event as a dead-letter candidate and does **not** commit the offset. Kafka will re-deliver on the next restart.
- **TODO:** Produce the failed message to an `order_placed.DLT` topic and commit the offset so the consumer can advance past the poison message without halting.

---

## Idempotency correctness note

This module performs a check-before-process step using `IdempotencyStore`, but **this alone does not guarantee exactly-once processing**. True duplicate safety requires one of:

- **Atomic write:** The handler side effect and the `processed_events` INSERT are wrapped in the same PostgreSQL transaction (backend teammate implements this).
- **Idempotent side effect:** The OpenSearch upsert by `orderId` always produces the same document, so re-processing is harmless.

Do not assume this module provides exactly-once guarantees until the durable `IdempotencyStore` is integrated and the atomicity question is settled with the backend teammate.
