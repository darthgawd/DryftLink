import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(10, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(10, "REDIS_URL is required"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(1)
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Worker environment invalid:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
