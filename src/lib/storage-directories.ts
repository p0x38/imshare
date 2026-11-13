import path from "node:path";
import type { ServerConfig } from "./config.js";
import { getPlatformDirectories } from "./platform-directories.js";
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
            return path.join(dataDirectory, "uploads");

        case "avatars":
            return path.join(dataDirectory, "avatars");

        case "cache":
            return path.join(dataDirectory, "cache");

        case "federation":
            return path.join(dataDirectory, "federation");
    }
}

export function resolveCacheDirectory(config?: ServerConfig): string {
    if (!config) {
        const override = process.env.IMSHARE_DATA_DIR?.trim();

        if (!override) {
            return getPlatformDirectories().cache;
        }

        return path.join(path.resolve(override), "cache");
    }

    return resolveStorageDirectory(config, "cache");
}

export async function ensureDataDirectory(config?: ServerConfig): Promise<string> {
    const directory = resolveDataDirectory(config);
    await mkdir(directory, { recursive: true });
    return directory;
}
