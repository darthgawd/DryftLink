import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate, getUserId } from "../auth.js";
import { startScheduledChecks, stopScheduledChecks, updateScheduledChecks } from "../scheduler.js";

const SiteCreate = z.object({
  name: z.string().trim().min(2).max(80),
  url: z.string().trim().url(),
  checkInterval: z.coerce.number().int().min(1).max(1440).default(5), // 1 min to 24 hours
  isMonitoringEnabled: z.boolean().default(true)
});

const SiteUpdate = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  url: z.string().trim().url().optional(),
  checkInterval: z.coerce.number().int().min(1).max(1440).optional(),
  isMonitoringEnabled: z.boolean().optional()
});

const SiteIdParam = z.object({
  id: z.string().cuid()
});

const SitesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().cuid().optional()
});

export async function sitesRoutes(app: FastifyInstance) {
  // List all sites
  app.get("/sites", { preHandler: authenticate }, async (req, reply) => {
    const userId = getUserId(req);

    const qParsed = SitesQuery.safeParse(req.query);
    if (!qParsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: qParsed.error.flatten() });
    }
    const { limit, cursor } = qParsed.data;

    const sites = await prisma.site.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const hasMore = sites.length > limit;
    const items = hasMore ? sites.slice(0, limit) : sites;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return { items, nextCursor };
  });

  // Create site
  app.post("/sites", { preHandler: authenticate }, async (req, reply) => {
    const parsed = SiteCreate.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }

    const userId = getUserId(req);

    try {
      const site = await prisma.site.create({
        data: {
          ...parsed.data,
          userId
        }
      });

      // Start scheduled checks if monitoring is enabled
      if (site.isMonitoringEnabled) {
        await startScheduledChecks({
          siteId: site.id,
          intervalMinutes: site.checkInterval
        });
      }

      return reply.code(201).send(site);
    } catch (err: any) {
      // Unique url constraint (userId + url)
      if (err?.code === "P2002") {
        return reply.code(409).send({ error: "site_exists" });
      }
      throw err;
    }
  });

  // Get single site
  app.get("/sites/:id", { preHandler: authenticate }, async (req, reply) => {
    const paramParsed = SiteIdParam.safeParse(req.params);
    if (!paramParsed.success) {
      return reply.code(400).send({ error: "invalid_site_id" });
    }

    const userId = getUserId(req);
    const { id } = paramParsed.data;

    const site = await prisma.site.findUnique({
      where: { id, userId }
    });

    if (!site) {
      return reply.code(404).send({ error: "site_not_found" });
    }

    return site;
  });

  // Update site
  app.patch("/sites/:id", { preHandler: authenticate }, async (req, reply) => {
    const paramParsed = SiteIdParam.safeParse(req.params);
    if (!paramParsed.success) {
      return reply.code(400).send({ error: "invalid_site_id" });
    }

    const bodyParsed = SiteUpdate.safeParse(req.body);
    if (!bodyParsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: bodyParsed.error.flatten() });
    }

    const userId = getUserId(req);
    const { id } = paramParsed.data;
    const updates = bodyParsed.data;

    // Check site exists and user owns it
    const existingSite = await prisma.site.findUnique({
      where: { id, userId }
    });

    if (!existingSite) {
      return reply.code(404).send({ error: "site_not_found" });
    }

    try {
      // Filter out undefined values for exactOptionalPropertyTypes
      const data: any = {};
      if (updates.name !== undefined) data.name = updates.name;
      if (updates.url !== undefined) data.url = updates.url;
      if (updates.checkInterval !== undefined) data.checkInterval = updates.checkInterval;
      if (updates.isMonitoringEnabled !== undefined) data.isMonitoringEnabled = updates.isMonitoringEnabled;

      const site = await prisma.site.update({
        where: { id },
        data
      });

      // Handle scheduling changes
      const intervalChanged = updates.checkInterval !== undefined && updates.checkInterval !== existingSite.checkInterval;
      const monitoringChanged = updates.isMonitoringEnabled !== undefined && updates.isMonitoringEnabled !== existingSite.isMonitoringEnabled;

      if (intervalChanged || monitoringChanged) {
        if (site.isMonitoringEnabled) {
          // Update schedule with new interval
          await updateScheduledChecks({
            siteId: site.id,
            intervalMinutes: site.checkInterval
          });
        } else {
          // Stop scheduling if monitoring disabled
          await stopScheduledChecks(site.id);
        }
      }

      return site;
    } catch (err: any) {
      if (err?.code === "P2002") {
        return reply.code(409).send({ error: "site_exists" });
      }
      throw err;
    }
  });

  // Delete site
  app.delete("/sites/:id", { preHandler: authenticate }, async (req, reply) => {
    const paramParsed = SiteIdParam.safeParse(req.params);
    if (!paramParsed.success) {
      return reply.code(400).send({ error: "invalid_site_id" });
    }

    const userId = getUserId(req);
    const { id } = paramParsed.data;

    const site = await prisma.site.findUnique({
      where: { id, userId }
    });

    if (!site) {
      return reply.code(404).send({ error: "site_not_found" });
    }

    // Stop scheduled checks before deleting
    await stopScheduledChecks(id);

    await prisma.site.delete({
      where: { id }
    });

    return { message: "site_deleted" };
  });
}
