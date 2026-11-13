import path from "node:path";
import type { ServerConfig } from "./config.js";
import {
    resolveStorageDirectory,
    ensureStorageDirectory,
    type StorageArea,
} from "./storage-directories.js";

export type UploadStorageArea = Extract<StorageArea, "uploads" | "avatars">;

export function uploadStorageDirectory(
    config: ServerConfig,
    area: UploadStorageArea = "uploads",
): string {
    return resolveStorageDirectory(config, area);
}

export async function ensureUploadStorageDirectory(
    config: ServerConfig,
    area: UploadStorageArea = "uploads",
): Promise<string> {
    return ensureStorageDirectory(config, area);
}

export function resolveUploadStoragePath(directory: string, filename: string): string | null {
    if (!filename || filename.includes("\0")) return null;

    const root = path.resolve(directory);
    const target = path.resolve(root, filename);
    const relative = path.relative(root, target);

    if (
        !relative ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
    ) {
        return null;
    }

    return target;
}
