import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const databasePath = path.join(root, "test.db");

process.env.DATABASE_URL = "file:./test.db";
process.env.BETTER_AUTH_SECRET = "imshare-integration-test-secret";

for (const file of [databasePath, `${databasePath}-journal`, `${databasePath}-wal`, `${databasePath}-shm`]) {
  if (existsSync(file)) rmSync(file, { force: true });
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
execFileSync(pnpm, ["exec", "prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "test/api.test.ts", "test/integration.test.ts"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

for (const file of [databasePath, `${databasePath}-journal`, `${databasePath}-wal`, `${databasePath}-shm`]) {
  if (existsSync(file)) rmSync(file, { force: true });
}

process.exit(result.status ?? 1);
