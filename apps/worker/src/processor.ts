import { Worker } from "bullmq";
import { z } from "zod";
import { connection, QUEUE_NAME } from "./queue.js";
import { env } from "./env.js";
import { prisma } from "./db.js";
import { updateUptimeState } from "./uptime-state.js";
import { createSnapshot } from "./snapshot.js";

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
      select: { id: true, url: true, isMonitoringEnabled: true }
    });

    if (!site) {
      throw new Error("site_not_found");
    }

    // Skip processing if monitoring is disabled
    if (site.isMonitoringEnabled === false) {
      return { status: "SKIPPED", httpStatus: null, durationMs: 0 };
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

    // Create SiteCheck record
    await prisma.siteCheck.create({
      data: {
        siteId,
        status,
        httpStatus,
        finalUrl,
        durationMs
      }
    });

    // Update uptime state machine
    await updateUptimeState(siteId, {
      status,
      httpStatus,
      finalUrl,
      durationMs
    });

    // Capture snapshot (HTML + fingerprint) for change detection, if check succeeded
    if (status === "SUCCESS") {
      try {
        const htmlResponse = await fetch(site.url, {
          method: "GET",
          signal: AbortSignal.timeout(10000)
        });

        if (htmlResponse.ok) {
          const htmlBody = await htmlResponse.text();
          
          // Convert Headers to plain object
          const headers: Record<string, string | string[] | undefined> = {};
          htmlResponse.headers.forEach((value, key) => {
            headers[key] = value;
          });

          // Create snapshot asynchronously (non-blocking)
          await createSnapshot(siteId, htmlBody, htmlResponse.status, headers);
        }
      } catch (err) {
        // Snapshot capture failed, but don't fail the job
        // Log error for debugging
        console.error(`Failed to capture snapshot for site ${siteId}:`, err);
      }
    }

    return { status, httpStatus, durationMs };
  },
  {
    connection: connection as any,
    concurrency: env.WORKER_CONCURRENCY
  }
);
