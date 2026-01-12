import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { env } from "./env.js";
import { sitesRoutes } from "./routes/sites.js";
import { checksRoutes } from "./routes/checks.js";
import { authRoutes } from "./routes/auth.js";
import jwt from "@fastify/jwt"; 

const app = Fastify({ logger: true });

await app.register(jwt, { 
  secret: env.JWT_SECRET,
});

await app.register(sensible);

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser clients
    if (origin === "http://localhost:5173") return cb(null, true);
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
  app.log.error(err);
  reply.code(500).send({ error: "internal_error" });
});

app.listen({ port: env.API_PORT, host: "0.0.0.0" });
