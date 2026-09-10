import { prisma } from "./lib/auth.js";
import { loadConfig } from "./lib/config.js";
import { buildApp } from "./app.js";

const config = await loadConfig();
const app = await buildApp();

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await app.listen({ host: config.server.host, port: config.server.port });
  app.log.info(
    `imshare listening on http://${config.server.host}:${config.server.port}`,
  );
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
