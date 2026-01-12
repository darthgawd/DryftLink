import IORedis from "ioredis";
import { Queue } from "bullmq";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error("REDIS_URL is required");
}

export const QUEUE_NAME = "dryft";

export const connection = new IORedis.default(REDIS_URL, {
  maxRetriesPerRequest: null
});

export const dryftQueue = new Queue(QUEUE_NAME, { connection: connection as any });
