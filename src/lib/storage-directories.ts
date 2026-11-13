import path from "node:path";
import type { ServerConfig } from "./config.js";
import { getPlatformDirectories, getTemporaryDirectory } from "./platform-directories.js";
import { mkdir } from "node:fs/promises";

export type StorageArea = "uploads" | "avatars" | "cache" | "federation";

function resolveConfiguredPath(value: string): string {
    return path.resolve(process.cwd(), value);
}

export function resolveDataDirectory(config?: ServerConfig): string {
    const override = process.env.IMSHARE_DATA_DIR?.trim();

    if (override) {
        return path.resolve(override);
    }

    const configured = config?.storage.dataDirectory;

    if (configured) {
        return resolveConfiguredPath(configured);
    }

    return getPlatformDirectories().data;
}

export function resolveStorageDirectory(config: ServerConfig, area: StorageArea): string {
    const configured = {
        uploads: config.storage.uploadDirectory,
        avatars: config.storage.avatarDirectory,
    }[area as "uploads" | "avatars"];

    if (configured) {
        return resolveConfiguredPath(configured);
    }

    const dataDirectory = resolveDataDirectory(config);

    switch (area) {
        case "uploads":
            return config.storage.uploadDirectory
                ? resolveConfiguredPath(config.storage.uploadDirectory)
                : path.join(resolveDataDirectory(config), "uploads");

        case "avatars":
            return config.storage.avatarDirectory
                ? resolveConfiguredPath(config.storage.avatarDirectory)
                : path.join(resolveDataDirectory(config), "avatars");

        case "cache":
            return resolveCacheDirectory(config);

        case "federation":
            return path.join(resolveDataDirectory(config), "federation");
    }
}

export function resolveCacheDirectory(config?: ServerConfig): string {
    if (config?.storage.dataDirectory) {
        return path.join(resolveDataDirectory(config), "cache");
    }

    const override = process.env.IMSHARE_DATA_DIR?.trim();

    if (override) {
        return path.join(path.resolve(override), "cache");
    }

    return getPlatformDirectories().cache;
}

export function resolveTemporaryDirectory(): string {
    return getTemporaryDirectory();
}

export async function ensureTemporaryDirectory(): Promise<string> {
    const directory = resolveTemporaryDirectory();
    await mkdir(directory, { recursive: true });
    return directory;
}

export async function ensureStorageDirectory(
    config: ServerConfig,
    area: StorageArea,
): Promise<string> {
    const directory = resolveStorageDirectory(config, area);
    await mkdir(directory, { recursive: true });
    return directory;
}

export async function ensureDataDirectory(config?: ServerConfig): Promise<string> {
    const directory = resolveDataDirectory(config);
    await mkdir(directory, { recursive: true });
    return directory;
}
