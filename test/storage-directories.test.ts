import { afterEach, expect, test, vi } from "vitest";
import path from "node:path";
import { resolveDataDirectory, resolveStorageDirectory } from "../src/lib/storage-directories.js";
import type { ServerConfig } from "../src/lib/config.js";

const config = {
    storage: {
        maxFileSize: 25 * 1024 * 1024,
    },
} as ServerConfig;

afterEach(() => {
    vi.unstubAllEnvs();
});

test("uses the configured data directory", () => {
    const configured = {
        storage: {
            dataDirectory: "contents",
            maxFileSize: 25 * 1024 * 1024,
        },
    } as ServerConfig;

    expect(resolveDataDirectory(configured)).toBe(path.resolve(process.cwd(), "contents"));
});

test("uses the platform data directory by default", () => {
    const dataDirectory = resolveDataDirectory(config);

    expect(path.isAbsolute(dataDirectory)).toBe(true);
    expect(dataDirectory).not.toBe(path.resolve("data"));
});

test("environment override takes precedence over configuration", () => {
    vi.stubEnv("IMSHARE_DATA_DIR", "C:\\ImShareData");

    const configured = {
        storage: {
            dataDirectory: "contents",
            maxFileSize: 25 * 1024 * 1024,
        },
    } as ServerConfig;

    expect(resolveDataDirectory(configured)).toBe(path.resolve("C:\\ImShareData"));
});

test("derives upload and avatar directories from the configured data root", () => {
    const configured = {
        storage: {
            dataDirectory: "contents",
            maxFileSize: 25 * 1024 * 1024,
        },
    } as ServerConfig;

    const dataDirectory = path.resolve("contents");

    expect(resolveStorageDirectory(configured, "uploads")).toBe(
        path.join(dataDirectory, "uploads"),
    );

    expect(resolveStorageDirectory(configured, "avatars")).toBe(
        path.join(dataDirectory, "avatars"),
    );
});
