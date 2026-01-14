import { dryftQueue } from "./queue.js";

/**
 * Scheduler service for managing repeatable site checks
 */

export interface ScheduleCheckOptions {
  siteId: string;
  intervalMinutes: number;
}

/**
 * Start scheduled checks for a site
 */
export async function startScheduledChecks(options: ScheduleCheckOptions): Promise<void> {
  const { siteId, intervalMinutes } = options;
  const jobId = `site:${siteId}:scheduled-check`;

  await dryftQueue.add(
    "check_site",
    { siteId },
    {
      jobId,
      repeat: {
        every: intervalMinutes * 60 * 1000 // convert minutes to milliseconds
      }
    }
  );
}

/**
 * Stop scheduled checks for a site
 */
export async function stopScheduledChecks(siteId: string): Promise<void> {
  // Get all repeatable jobs and find the one for this site
  const repeatableJobs = await dryftQueue.getRepeatableJobs();
  
  for (const job of repeatableJobs) {
    // Check if this is the job for our site
    if (job.name === "check_site" && job.id === `site:${siteId}:scheduled-check`) {
      await dryftQueue.removeRepeatableByKey(job.key);
    }
  }
}

/**
 * Update scheduled check interval for a site
 */
export async function updateScheduledChecks(options: ScheduleCheckOptions): Promise<void> {
  const { siteId } = options;
  
  // Stop existing schedule
  await stopScheduledChecks(siteId);
  
  // Start new schedule with updated interval
  await startScheduledChecks(options);
}

/**
 * Get all repeatable jobs (for debugging)
 */
export async function getRepeatableJobs() {
  return await dryftQueue.getRepeatableJobs();
}
