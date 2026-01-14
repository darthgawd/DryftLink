import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.string().default("development"),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid database connection URL"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid Redis connection URL"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ALLOWED_ORIGINS: z.string().optional()
});

export const env = Env.parse(process.env);
