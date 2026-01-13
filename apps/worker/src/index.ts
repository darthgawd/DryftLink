import { worker } from "./processor.js";
import { prisma } from "./db.js";

worker.on("ready", () => {
  console.log("[worker] ready");
});

worker.on("failed", (job, err) => {
  console.error("[worker] failed", { id: job?.id, name: job?.name, err: err.message });
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
