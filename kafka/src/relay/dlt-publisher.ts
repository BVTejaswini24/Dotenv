/**
 * relay/dlt-publisher.ts
 *
 * DEPRECATED — functionality already exists in relay/publisher.ts
 *
 * The working publishToDlt() function is exported from:
 *   kafka/src/relay/publisher.ts
 *
 * This file previously imported a non-existent `getRelayProducer` from
 * outbox-relay.ts. That function was never exported and caused a broken import.
 *
 * This file is kept for reference only. It MUST NOT be imported.
 * Re-export the working function for any code that needs it:
 *
 *   import { publishToDlt } from "./publisher";
 */

export {};
