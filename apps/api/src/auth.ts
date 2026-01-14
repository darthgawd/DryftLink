import type { FastifyRequest, FastifyReply } from "fastify";
import { connection as redis } from "./queue.js";

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
    
    // Check if token is blacklisted (revoked)
    const user = request.user as { sub: string; email: string; jti?: string };
    if (user.jti) {
      const blacklisted = await redis.get(`blacklist:${user.jti}`);
      if (blacklisted) {
        return reply.code(401).send({ error: "token_revoked" });
      }
    }
  } catch (err) {
    return reply.code(401).send({ error: "unauthorized" });
  }
}

export function getUserId(request: FastifyRequest): string {
  // @fastify/jwt adds user property after jwtVerify()
  // The user object contains the JWT payload (sub, email, etc.)
  const user = request.user as { sub: string; email: string };
  if (!user || !user.sub) {
    throw Object.assign(new Error("User not authenticated"), { statusCode: 401 });
  }
  return user.sub;
}
