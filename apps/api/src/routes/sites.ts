import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate, getUserId } from "../auth.js";

const SiteCreate = z.object({
  name: z.string().trim().min(2).max(80),
  url: z.string().trim().url()
});

const SitesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().cuid().optional()
});


export async function sitesRoutes(app: FastifyInstance) {
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
      return reply.code(201).send(site);
    } catch (err: any) {
      // Unique url constraint (userId + url)
      if (err?.code === "P2002") {
        return reply.code(409).send({ error: "site_exists" });
      }
      throw err;
    }
  });
}
