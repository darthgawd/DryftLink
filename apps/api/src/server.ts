import Fastify from "fastify";
import { env } from "./env.js";

const app = Fastify({
  logger: true
});

app.get("/health", async () => {
  return { status: "ok" };
});

app.listen({ port: env.API_PORT, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`API listening on ${env.API_PORT}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
