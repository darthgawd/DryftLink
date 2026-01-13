// apps/api/src/server.ts
import Fastify, { type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import jwt from "@fastify/jwt";

import { env } from "./env.js";
import { prisma } from "./db.js";
import { authRoutes } from "./routes/auth.js";
import { checksRoutes } from "./routes/checks.js";
import { sitesRoutes } from "./routes/sites.js";

function sendError(reply: FastifyReply, code: number, error: string, details?: unknown) {
  return reply.code(code).send({ error, ...(details ? { details } : {}) });
}

const app = Fastify({
  logger: true,
  bodyLimit: 1024 * 1024 // 1MB
});

// Plugins
await app.register(jwt, { secret: env.JWT_SECRET });
await app.register(sensible);

await app.register(cors, {
  origin: (origin, cb) => {
    const allowed = env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? [];

    // Allow no-origin only in non-production (curl/Postman)
    if (!origin && env.NODE_ENV !== "production") return cb(null, true);

    if (origin && allowed.includes(origin)) return cb(null, true);

    return cb(new Error("Not allowed"), false);
  }
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute"
});

// Routes
await app.register(authRoutes);
await app.register(checksRoutes);
await app.register(sitesRoutes);

// Liveness only (no DB/Redis checks)
app.get("/health", async () => ({ status: "ok" }));

// Error handler: preserve statusCode when present
app.setErrorHandler((err, _req, reply) => {
  const anyErr = err as Error & { statusCode?: number; code?: string };
  const status = typeof anyErr.statusCode === "number" ? anyErr.statusCode : 500;

  if (env.NODE_ENV !== "production") {
    app.log.error(anyErr);
  } else {
    app.log.error({ msg: anyErr.message, code: anyErr.code, status });
  }

  if (status >= 500) return sendError(reply, 500, "internal_error");
  return sendError(reply, status, "request_error");
});

// Start
await app.listen({ port: env.API_PORT, host: "0.0.0.0" });

// Graceful shutdown
let shuttingDown = false;

const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;

  app.log.info(`${signal} received, shutting down...`);

  try {
    await app.close();
  } catch (e) {
    app.log.error(e);
  }

  try {
    await prisma.$disconnect();
  } catch (e) {
    app.log.error(e);
  }

  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
