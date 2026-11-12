import path from "node:path";
import type { ServerConfig } from "./config.js";

export type UploadStorageArea = "uploads" | "avatars";

export function uploadStorageDirectory(
    config: ServerConfig,
    area: UploadStorageArea = "uploads",
): string {
    const configured =
        area === "avatars" ? config.storage.avatarDirectory : config.storage.uploadDirectory;
    return path.resolve(process.cwd(), configured ?? "data/uploads");
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
    )
        return null;

    return target;
}
