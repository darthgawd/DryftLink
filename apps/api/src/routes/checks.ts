import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { dryftQueue } from "../queue.js";

export async function checksRoutes(app: FastifyInstance) {
  app.post("/sites/:id/check", async (req, reply) => {
    const siteId = (req.params as any).id as string;

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      return reply.code(404).send({ error: "site_not_found" });
    }

    const job = await dryftQueue.add("check_site", { siteId });
    return reply.code(202).send({ jobId: job.id });
  });
}
