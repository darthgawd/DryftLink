import { Worker } from "bullmq";
import { z } from "zod";
import { connection, QUEUE_NAME } from "./queue.js";
import { env } from "./env.js";
import { prisma } from "./db.js";

const JobData = z.object({
  siteId: z.string().min(1),
  userId: z.string().min(1)
});

export const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const parsed = JobData.safeParse(job.data);
    if (!parsed.success) {
      throw new Error("invalid_job_payload");
    }

    const { siteId, userId } = parsed.data;

    // Verify site belongs to user
    const site = await prisma.site.findFirst({
      where: { id: siteId, userId },
      select: { id: true, url: true }
    });

    if (!site) {
      throw new Error("site_not_found");
    }

    const startTime = Date.now();
    let statusCode: number | null = null;
    let ok = false;
    let error: string | null = null;

    try {
      const response = await fetch(site.url, {
        method: "HEAD",
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      statusCode = response.status;
      ok = response.ok;
    } catch (err) {
      error = err instanceof Error ? err.message : "unknown_error";
      ok = false;
    }

    const latencyMs = Date.now() - startTime;

    // Create SiteCheck record
    await prisma.siteCheck.create({
      data: {
        siteId,
        userId,
        statusCode,
        latencyMs,
        ok,
        error
      }
    });

    return { ok, statusCode, latencyMs };
  },
  {
    connection,
    concurrency: env.WORKER_CONCURRENCY
  }
);
