import { prisma } from "./db.js";
import type { SiteCheckStatus, UptimeState } from "@prisma/client";

/**
 * Uptime State Machine
 * 
 * Determines site state (UP/DOWN) from check results and manages state transitions.
 */

interface CheckResult {
  status: SiteCheckStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  durationMs: number;
}

/**
 * Determine uptime state from check status
 * 
 * Logic:
 * - SUCCESS → UP
 * - ERROR, TIMEOUT, BLOCKED → DOWN
 */
function determineState(status: SiteCheckStatus): UptimeState {
  return status === "SUCCESS" ? "UP" : "DOWN";
}

/**
 * Update site uptime state after a check with confirmation logic
 * 
 * Confirmation prevents false positives by requiring multiple consecutive
 * failures before marking DOWN (and multiple successes before marking UP).
 * 
 * Flow:
 * 1. Determine what state the check indicates (UP or DOWN)
 * 2. Track consecutive results (failures or successes)
 * 3. Only transition state after confirmation threshold is met
 * 4. Reset counters when result type changes
 */
export async function updateUptimeState(
  siteId: string,
  checkResult: CheckResult
): Promise<void> {
  const newCheckState = determineState(checkResult.status);
  const now = new Date();

  // Get site configuration and current state
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { confirmationsRequired: true }
  });

  if (!site) {
    console.error(`[Uptime] Site ${siteId} not found`);
    return;
  }

  const currentState = await prisma.siteUptimeState.findUnique({
    where: { siteId }
  });

  // Case 1: First check - initialize state with optimistic assumption
  // Always initialize as UP, track failures/successes for confirmation
  if (!currentState) {
    // Always initialize as UP (optimistic), but track consecutive results
    // If first check fails, we'll transition to DOWN on next failure (after confirmation)
    const initialState: UptimeState = "UP";
    
    await prisma.siteUptimeState.create({
      data: {
        siteId,
        state: initialState,
        lastStatus: checkResult.status,
        lastHttpStatus: checkResult.httpStatus,
        lastFinalUrl: checkResult.finalUrl,
        lastDurationMs: checkResult.durationMs,
        consecutiveFailures: newCheckState === "DOWN" ? 1 : 0,
        consecutiveSuccesses: newCheckState === "UP" ? 1 : 0,
        changedAt: now
      }
    });

    console.log(`[Uptime] Site ${siteId} initialized: ${initialState} (first check: ${checkResult.status})`);
    return;
  }

  // Case 2: Check indicates DOWN
  if (newCheckState === "DOWN") {
    const failures = currentState.consecutiveFailures + 1;

    // Check if we've reached confirmation threshold
    if (failures >= site.confirmationsRequired && currentState.state === "UP") {
      // CONFIRMED DOWN - create event and transition
      await prisma.uptimeEvent.create({
        data: {
          siteId,
          fromState: "UP",
          toState: "DOWN",
          reasonStatus: checkResult.status,
          reasonHttpStatus: checkResult.httpStatus,
          checkedAt: now
        }
      });

      await prisma.siteUptimeState.update({
        where: { siteId },
        data: {
          state: "DOWN",
          lastStatus: checkResult.status,
          lastHttpStatus: checkResult.httpStatus,
          lastFinalUrl: checkResult.finalUrl,
          lastDurationMs: checkResult.durationMs,
          consecutiveFailures: 0, // Reset after transition
          consecutiveSuccesses: 0,
          changedAt: now
        }
      });

      console.log(
        `[Uptime] Site ${siteId} CONFIRMED DOWN after ${failures} consecutive failures (${checkResult.status})`
      );
    } else {
      // Still confirming or already DOWN
      await prisma.siteUptimeState.update({
        where: { siteId },
        data: {
          lastStatus: checkResult.status,
          lastHttpStatus: checkResult.httpStatus,
          lastFinalUrl: checkResult.finalUrl,
          lastDurationMs: checkResult.durationMs,
          consecutiveFailures: failures,
          consecutiveSuccesses: 0 // Reset successes
        }
      });

      if (currentState.state === "UP") {
        console.log(
          `[Uptime] Site ${siteId} confirming DOWN (${failures}/${site.confirmationsRequired})`
        );
      } else {
        console.log(`[Uptime] Site ${siteId} still DOWN`);
      }
    }
    return;
  }

  // Case 3: Check indicates UP (SUCCESS)
  const successes = currentState.consecutiveSuccesses + 1;

  // Check if we've reached confirmation threshold
  if (successes >= site.confirmationsRequired && currentState.state === "DOWN") {
    // CONFIRMED UP - recovery!
    await prisma.uptimeEvent.create({
      data: {
        siteId,
        fromState: "DOWN",
        toState: "UP",
        reasonStatus: checkResult.status,
        reasonHttpStatus: checkResult.httpStatus,
        checkedAt: now
      }
    });

    await prisma.siteUptimeState.update({
      where: { siteId },
      data: {
        state: "UP",
        lastStatus: checkResult.status,
        lastHttpStatus: checkResult.httpStatus,
        lastFinalUrl: checkResult.finalUrl,
        lastDurationMs: checkResult.durationMs,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0, // Reset after transition
        changedAt: now
      }
    });

    console.log(
      `[Uptime] Site ${siteId} CONFIRMED UP after ${successes} consecutive successes (recovery)`
    );
  } else {
    // Still confirming or already UP
    await prisma.siteUptimeState.update({
      where: { siteId },
      data: {
        lastStatus: checkResult.status,
        lastHttpStatus: checkResult.httpStatus,
        lastFinalUrl: checkResult.finalUrl,
        lastDurationMs: checkResult.durationMs,
        consecutiveFailures: 0, // Reset failures
        consecutiveSuccesses: successes
      }
    });

    if (currentState.state === "DOWN") {
      console.log(
        `[Uptime] Site ${siteId} confirming UP (${successes}/${site.confirmationsRequired})`
      );
    } else {
      console.log(`[Uptime] Site ${siteId} still UP`);
    }
  }
}

/**
 * Get current uptime state for a site
 */
export async function getCurrentState(siteId: string) {
  return await prisma.siteUptimeState.findUnique({
    where: { siteId }
  });
}

/**
 * Get uptime events for a site (state transition history)
 */
export async function getUptimeEvents(siteId: string, limit = 50) {
  return await prisma.uptimeEvent.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

/**
 * Calculate uptime statistics for a site
 */
export async function getUptimeStats(siteId: string, periodDays = 30) {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  // Get all checks in period
  const checks = await prisma.siteCheck.findMany({
    where: {
      siteId,
      checkedAt: { gte: since }
    },
    orderBy: { checkedAt: "asc" }
  });

  if (checks.length === 0) {
    return {
      uptimePercentage: 0,
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0
    };
  }

  const successfulChecks = checks.filter((c) => c.status === "SUCCESS").length;
  const failedChecks = checks.length - successfulChecks;
  const uptimePercentage = (successfulChecks / checks.length) * 100;

  return {
    uptimePercentage: Math.round(uptimePercentage * 100) / 100, // 2 decimal places
    totalChecks: checks.length,
    successfulChecks,
    failedChecks
  };
}
