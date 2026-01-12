import type { FastifyInstance } from "fastify";
import { z } from "zod";
import argon2 from "argon2";
import { prisma } from "../db.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(12),
      })
      .parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return reply.code(409).send({ error: "email_taken" });

    const passwordHash = await argon2.hash(body.password);

    const user = await prisma.user.create({
      data: { email: body.email, passwordHash },
      select: { id: true, email: true },
    });

    const token = app.jwt.sign({ sub: user.id, email: user.email });

    return reply.code(201).send({ token, user });
  });

  app.post("/auth/login", async (req, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return reply.code(401).send({ error: "invalid_credentials" });

    const ok = await argon2.verify(user.passwordHash, body.password);
    if (!ok) return reply.code(401).send({ error: "invalid_credentials" });

    const token = app.jwt.sign({ sub: user.id, email: user.email });

    return reply.send({ token, user: { id: user.id, email: user.email } });
  });
}
