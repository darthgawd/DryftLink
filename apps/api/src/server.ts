import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { env } from "./env.js";
import { sitesRoutes } from "./routes/sites.js";
import { checksRoutes } from "./routes/checks.js";
import { authRoutes } from "./routes/auth.js";
import jwt from "@fastify/jwt"; 
import { prisma } from "./db.js";
import { dryftQueue } from "./queue.js";
import type { FastifyReply } from "fastify";

function sendError(reply: FastifyReply, code: number, error: string, details?: unknown) {
  return reply.code(code).send({ error, ...(details ? { details } : {}) });
}

const app = Fastify({ logger: true, bodyLimit: 1024 * 1024  });

await app.register(jwt, { 
  secret: env.JWT_SECRET,
});

await app.register(sensible);

await app.register(cors, {
  origin: (origin, cb) => {
    // Allow specific origins from environment
    const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    if (origin && allowedOrigins.includes(origin)) {
      return cb(null, true);
    }

    // Allow no-origin only in dev (curl/Postman)
    if (!origin && env.NODE_ENV !== "production") {
      return cb(null, true);
    }

    return cb(new Error("Not allowed"), false);
  }
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute"
});

await app.register(authRoutes);
await app.register(checksRoutes);
await app.register(sitesRoutes);

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);

app.get("/health", async (_req, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await withTimeout(dryftQueue.getJobCounts(), 500); // <— add timeout
    return { status: "ok" };
  } catch {
    return reply.code(503).send({ status: "degraded" });
  }
});

app.setErrorHandler((err, _req, reply) => {
  if (env.NODE_ENV !== "production") {
    app.log.error(err);
  } else {
    const e = err as Error & { code?: string };
    app.log.error({ msg: e.message, code: e.code });
  }
  return sendError(reply, 500, "internal_error");
});



const server = await app.listen({ port: env.API_PORT, host: "0.0.0.0" });

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down gracefully`);
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
