import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.string().default("development"),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters") // Add this
});

export const env = Env.parse(process.env);
