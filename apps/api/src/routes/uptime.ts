import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, getUserId } from "../auth.js";
import { prisma } from "../db.js";

const StatsQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30)
});

export async function uptimeRoutes(app: FastifyInstance) {
  // Get current uptime state for a site
  app.get(
    "/sites/:id/uptime",
    { preHandler: authenticate },
    async (req, reply) => {
      const userId = getUserId(req);
      const { id: siteId } = req.params as { id: string };

      // Verify site ownership
      const site = await prisma.site.findFirst({
        where: { id: siteId, userId }
      });

      if (!site) {
        return reply.code(404).send({ error: "site_not_found" });
      }

      // Get uptime state
      const state = await prisma.siteUptimeState.findUnique({
        where: { siteId }
      });

      if (!state) {
        return reply.send({
          state: null,
          message: "No checks performed yet"
        });
      }

      return reply.send({
        state: state.state,
        lastStatus: state.lastStatus,
        lastHttpStatus: state.lastHttpStatus,
        lastFinalUrl: state.lastFinalUrl,
        lastDurationMs: state.lastDurationMs,
        changedAt: state.changedAt,
        updatedAt: state.updatedAt
      });
    }
  );

  // Get uptime events (state transition history)
  app.get(
    "/sites/:id/uptime/events",
    { preHandler: authenticate },
    async (req, reply) => {
      const userId = getUserId(req);
      const { id: siteId } = req.params as { id: string };

      // Verify site ownership
      const site = await prisma.site.findFirst({
        where: { id: siteId, userId }
      });

      if (!site) {
        return reply.code(404).send({ error: "site_not_found" });
      }

      // Get uptime events
      const events = await prisma.uptimeEvent.findMany({
        where: { siteId },
        orderBy: { createdAt: "desc" },
        take: 100
      });

      return reply.send({ events });
    }
  );

  // Get uptime statistics
  app.get(
    "/sites/:id/uptime/stats",
    { preHandler: authenticate },
    async (req, reply) => {
      const userId = getUserId(req);
      const { id: siteId } = req.params as { id: string };

      // Parse query params
      const qParsed = StatsQuery.safeParse(req.query);
      if (!qParsed.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      const { days } = qParsed.data;

      // Verify site ownership
      const site = await prisma.site.findFirst({
        where: { id: siteId, userId }
      });

      if (!site) {
        return reply.code(404).send({ error: "site_not_found" });
      }

      // Calculate uptime stats
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const checks = await prisma.siteCheck.findMany({
        where: {
          siteId,
          checkedAt: { gte: since }
        },
        orderBy: { checkedAt: "asc" }
      });

      if (checks.length === 0) {
        return reply.send({
          periodDays: days,
          uptimePercentage: null,
          totalChecks: 0,
          successfulChecks: 0,
          failedChecks: 0,
          avgResponseTimeMs: null
        });
      }

      const successfulChecks = checks.filter((c) => c.status === "SUCCESS");
      const failedChecks = checks.length - successfulChecks.length;
      const uptimePercentage = (successfulChecks.length / checks.length) * 100;

      // Calculate average response time for successful checks
      const successfulDurations = successfulChecks
        .map((c) => c.durationMs)
        .filter((d): d is number => d !== null);

      const avgResponseTimeMs =
        successfulDurations.length > 0
          ? successfulDurations.reduce((a, b) => a + b, 0) /
            successfulDurations.length
          : null;

      return reply.send({
        periodDays: days,
        uptimePercentage: Math.round(uptimePercentage * 100) / 100,
        totalChecks: checks.length,
        successfulChecks: successfulChecks.length,
        failedChecks,
        avgResponseTimeMs:
          avgResponseTimeMs !== null ? Math.round(avgResponseTimeMs) : null
      });
    }
  );
}
