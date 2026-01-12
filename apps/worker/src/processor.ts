import { Worker } from "bullmq";
import { z } from "zod";
import { connection, QUEUE_NAME } from "./queue.js";
import { env } from "./env.js";

const JobData = z.object({
  siteId: z.string().min(1)
});

export const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const parsed = JobData.safeParse(job.data);
    if (!parsed.success) {
      throw new Error("invalid_job_payload");
    }

    console.log("[worker] got job", {
      id: job.id,
      name: job.name,
      siteId: parsed.data.siteId
    });

    return { ok: true };
  },
  {
    connection,
    concurrency: env.WORKER_CONCURRENCY
  }
);
