import { prisma } from "./lib/auth.js";
import { loadConfig } from "./lib/config.js";
import { getRegistrationToken } from "./lib/registration-token.js";
import { buildApp } from "./app.js";
import { attachRealtime } from "./realtime.js";

const config = await loadConfig();
const app = await buildApp();
const io = attachRealtime(app.server);

const shutdown = async () => {
  await io.close();
  await app.close();
  await prisma.$disconnect();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await app.listen({ host: config.server.host, port: config.server.port });
  const registration = getRegistrationToken();
  app.log.info(`imshare listening on http://${config.server.host}:${config.server.port}`);
  app.log.info(`registration access token: ${registration.token} (expires ${new Date(registration.expiresAt).toISOString()})`);
} catch (error) {
  app.log.error(error);
  await io.close();
  await prisma.$disconnect();
  process.exit(1);
}
