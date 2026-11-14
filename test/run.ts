import "dotenv/config";

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const mode = process.argv[2] ?? "unit";
const extraArgs = process.argv.slice(3);

const testRoot = path.join(root, ".test-data");
const runId = `${process.pid}-${Date.now()}`;
const runDirectory = path.join(testRoot, runId);

const originalEnvironment = new Map(
    ["DATABASE_PROVIDER", "DATABASE_URL", "BETTER_AUTH_SECRET", "IMSHARE_CONFIG", "NODE_ENV"].map(
        (key) => [key, process.env[key]],
    ),
);

function runPnpm(args: string[]): void {
    const options = {
        cwd: root,
        env: process.env,
        stdio: "inherit" as const,
    };

    if (process.platform === "win32") {
        const pnpmCliPath = process.env.npm_execpath;

        if (!pnpmCliPath) {
            throw new Error("Unable to locate pnpm CLI. Run this script through `pnpm`.");
        }

        execFileSync(process.execPath, [pnpmCliPath, ...args], options);
        return;
    }

    execFileSync("pnpm", args, options);
}

function restoreEnvironment(): void {
    for (const [key, value] of originalEnvironment) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
}

function getTestArguments(): string[] {
    switch (mode) {
        case "unit":
            return ["exec", "vitest", "run", "--reporter=verbose", ...extraArgs];

        case "watch":
            return ["exec", "vitest"];

        case "integration":
            return ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"];

        case "coverage":
            return ["exec", "vitest", "run", "--coverage"];

        default:
            throw new Error(`Unknown test mode: ${mode}`);
    }
}

function getPrismaSchema(): string {
    const provider = process.env.DATABASE_PROVIDER?.trim() || "sqlite";

    switch (provider) {
        case "sqlite":
            return "prisma/sqlite/schema.prisma";

        case "postgresql":
            return "prisma/postgresql/schema.prisma";

        default:
            throw new Error(`Unsupported database provider: ${provider}`);
    }
}

async function main(): Promise<void> {
    mkdirSync(runDirectory, { recursive: true });

    // Override database configuration before Prisma or application modules load.
    process.env.DATABASE_PROVIDER = "sqlite";
    process.env.DATABASE_URL = `file:./.test-data/${runId}/test.db`;
    process.env.BETTER_AUTH_SECRET =
        "4c7e5a9d2f8b6e1a3d0c9f5b7a2e8c6d1f4a9b3e7c0d5f8a2b6e9c1d4f7a3b8";
    process.env.IMSHARE_CONFIG = "test/config.imshare";
    process.env.NODE_ENV = "test";

    try {
        const schema = getPrismaSchema();

        runPnpm(["exec", "prisma", "generate", "--schema", schema]);
        runPnpm(["exec", "prisma", "migrate", "deploy", "--schema", schema]);

        if (mode === "browser") {
            runPnpm(["build:client"]);
            runPnpm(["exec", "playwright", "test", ...extraArgs]);
        } else {
            runPnpm(getTestArguments());
        }
    } finally {
        restoreEnvironment();

        try {
            runPnpm(["exec", "prisma", "generate", "--schema", getPrismaSchema()]);
        } catch (error) {
            console.error(
                "Failed to restore Prisma Client for the configured database provider.",
                error,
            );
            process.exitCode = 1;
        }

        rmSync(runDirectory, { recursive: true, force: true });
    }
}

await main();
