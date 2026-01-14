import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { dryftQueue } from "../queue.js";
import { authenticate, getUserId } from "../auth.js";

const Params = z.object({
  id: z.string().cuid()
});

export async function checksRoutes(app: FastifyInstance) {
  app.post(
    "/sites/:id/check",
    {
      preHandler: authenticate,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
    },
    async (req, reply) => {
      const parsed = Params.safeParse(req.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
      }

      const userId = getUserId(req);
      const siteId = parsed.data.id;

      const site = await prisma.site.findFirst({
        where: { id: siteId, userId },
        select: { id: true }
      });

      if (!site) {
        return reply.code(404).send({ error: "site_not_found" });
      }

      const job = await dryftQueue.add("check_site", { siteId });
      return reply.code(202).send({ jobId: job.id });
    }
  );
}
