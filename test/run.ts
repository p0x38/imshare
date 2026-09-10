import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const databasePath = path.join(root, "test.db");
const databaseFiles = [
  databasePath,
  `${databasePath}-journal`,
  `${databasePath}-wal`,
  `${databasePath}-shm`,
];

process.env.DATABASE_URL = "file:./test.db";
process.env.BETTER_AUTH_SECRET = "imshare-integration-test-secret";

function cleanup(): void {
  for (const file of databaseFiles) {
    if (existsSync(file)) {
      rmSync(file, { force: true });
    }
  }
}

cleanup();

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const pnpmOptions = {
  cwd: root,
  env: process.env,
  stdio: "inherit" as const,
  ...(process.platform === "win32" ? { shell: true } : {}),
};

try {
  execFileSync(pnpm, ["exec", "prisma", "db", "push", "--accept-data-loss"], pnpmOptions);

  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--test", "test/api.test.ts", "test/integration.test.ts"],
    {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    },
  );

  process.exitCode = result.status ?? 1;
} finally {
  cleanup();
}
