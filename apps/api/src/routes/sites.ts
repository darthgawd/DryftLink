import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate, getUserId } from "../auth.js";

const SiteCreate = z.object({
  name: z.string().trim().min(2).max(80),
  url: z.string().trim().url()
});

export async function sitesRoutes(app: FastifyInstance) {
  app.get("/sites", { preHandler: authenticate }, async (req) => {
    const userId = getUserId(req);
    const sites = await prisma.site.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    return sites;
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
