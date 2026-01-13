import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { env } from "./env.js";
import { sitesRoutes } from "./routes/sites.js";
import { checksRoutes } from "./routes/checks.js";
import { authRoutes } from "./routes/auth.js";
import jwt from "@fastify/jwt"; 

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

app.get("/health", async () => ({ status: "ok" }));

app.setErrorHandler((err, _req, reply) => {
  if (env.NODE_ENV !== "production") {
    app.log.error(err);
  } else {
    const e = err as Error & { code?: string };
    app.log.error({ msg: e.message, code: e.code });
  }
  reply.code(500).send({ error: "internal_error" });
});


app.listen({ port: env.API_PORT, host: "0.0.0.0" });
