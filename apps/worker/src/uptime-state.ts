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
 * Update site uptime state after a check
 * 
 * - If state changed: create UptimeEvent + update state
 * - If state same: update lastXXX fields only
 */
export async function updateUptimeState(
  siteId: string,
  checkResult: CheckResult
): Promise<void> {
  const newState = determineState(checkResult.status);
  const now = new Date();

  // Get current state (if exists)
  const currentState = await prisma.siteUptimeState.findUnique({
    where: { siteId }
  });

  // Case 1: First check - initialize state
  if (!currentState) {
    await prisma.siteUptimeState.create({
      data: {
        siteId,
        state: newState,
        lastStatus: checkResult.status,
        lastHttpStatus: checkResult.httpStatus,
        lastFinalUrl: checkResult.finalUrl,
        lastDurationMs: checkResult.durationMs,
        changedAt: now
      }
    });

    console.log(`[Uptime] Site ${siteId} initialized: ${newState}`);
    return;
  }

  // Case 2: State changed - record transition event
  if (currentState.state !== newState) {
    // Create state transition event
    await prisma.uptimeEvent.create({
      data: {
        siteId,
        fromState: currentState.state,
        toState: newState,
        reasonStatus: checkResult.status,
        reasonHttpStatus: checkResult.httpStatus,
        checkedAt: now
      }
    });

    // Update state
    await prisma.siteUptimeState.update({
      where: { siteId },
      data: {
        state: newState,
        lastStatus: checkResult.status,
        lastHttpStatus: checkResult.httpStatus,
        lastFinalUrl: checkResult.finalUrl,
        lastDurationMs: checkResult.durationMs,
        changedAt: now
      }
    });

    console.log(
      `[Uptime] Site ${siteId} state changed: ${currentState.state} → ${newState} (${checkResult.status})`
    );
    return;
  }

  // Case 3: State unchanged - update last check details only
  await prisma.siteUptimeState.update({
    where: { siteId },
    data: {
      lastStatus: checkResult.status,
      lastHttpStatus: checkResult.httpStatus,
      lastFinalUrl: checkResult.finalUrl,
      lastDurationMs: checkResult.durationMs
      // Don't update changedAt - state didn't change
    }
  });

  console.log(`[Uptime] Site ${siteId} state unchanged: ${newState}`);
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
