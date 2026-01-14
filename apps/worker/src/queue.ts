import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env.js";

export const connection = new IORedis.default(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const QUEUE_NAME = "dryft";

export const dryftQueue = new Queue(QUEUE_NAME, {
  connection: connection as any
});
