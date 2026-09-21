import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./test/browser",
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: 1,

    reporter: [["list"], ["html", { open: "never" }]],

    use: {
        baseURL: "http://127.0.0.1:5454",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        video: {
            mode: "on",
            size: { width: 1280, height: 720 },
        },
        launchOptions: {
            args: ["--disable-gpu"],
        },
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "pnpm exec tsx src/server.ts",
        url: "http://127.0.0.1:5454/api/v1/health",
        reuseExistingServer: false,
        stdout: "pipe",
        stderr: "pipe",
        timeout: 120_000,
        env: {
            NODE_ENV: "test",
            IMSHARE_E2E: "true",
        },
    },
});
