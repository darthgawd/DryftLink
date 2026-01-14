import { Worker } from "bullmq";
import { z } from "zod";
import { connection, QUEUE_NAME } from "./queue.js";
import { env } from "./env.js";
import { prisma } from "./db.js";

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

    const { siteId } = parsed.data;

    // Fetch site for checking
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, url: true }
    });

    if (!site) {
      throw new Error("site_not_found");
    }

    const startTime = Date.now();
    let httpStatus: number | null = null;
    let finalUrl: string | null = null;
    let status: "SUCCESS" | "ERROR" | "TIMEOUT" | "BLOCKED" = "ERROR";

    try {
      const response = await fetch(site.url, {
        method: "HEAD",
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      httpStatus = response.status;
      finalUrl = response.url; // Capture final URL (after redirects)

      // Map HTTP response to SiteCheckStatus enum
      if (response.ok) {
        status = "SUCCESS";
      } else if (response.status === 403 || response.status === 401) {
        status = "BLOCKED";
      } else {
        status = "ERROR";
      }
    } catch (err) {
      // Check if it's a timeout or other error
      if (err instanceof Error && err.name === "TimeoutError") {
        status = "TIMEOUT";
      } else {
        status = "ERROR";
      }
      httpStatus = null;
      finalUrl = null;
    }

    const durationMs = Date.now() - startTime;

    // Create SiteCheck record with new schema
    await prisma.siteCheck.create({
      data: {
        siteId,
        status,
        httpStatus,
        finalUrl,
        durationMs
      }
    });

    return { status, httpStatus, durationMs };
  },
  {
    connection: connection as any,
    concurrency: env.WORKER_CONCURRENCY
  }
);
