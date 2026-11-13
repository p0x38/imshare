import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["test/**/*.test.ts"],
        exclude: ["node_modules", "dist", "test/integration.test.ts"],
        testTimeout: 15_000,
        fileParallelism: false,
        maxWorkers: 1,
        isolate: true,
        passWithNoTests: false,
    },
});
