import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const SiteCreate = z.object({
  name: z.string().trim().min(2).max(80),
  url: z.string().trim().url()
});

export async function sitesRoutes(app: FastifyInstance) {
  app.get("/sites", async () => {
    const sites = await prisma.site.findMany({
      orderBy: { createdAt: "desc" }
    });
    return sites;
  });

  app.post("/sites", async (req, reply) => {
    const parsed = SiteCreate.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }

    try {
      const site = await prisma.site.create({
        data: parsed.data
      });
      return reply.code(201).send(site);
    } catch (err: any) {
      // Unique url constraint
      if (err?.code === "P2002") {
        return reply.code(409).send({ error: "site_exists" });
      }
      throw err;
    }
  });
}
