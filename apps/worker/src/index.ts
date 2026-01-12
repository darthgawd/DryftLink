import { worker } from "./processor.js";

worker.on("ready", () => {
  console.log("[worker] ready");
});

worker.on("failed", (job, err) => {
  console.error("[worker] failed", { id: job?.id, name: job?.name, err: err.message });
});
