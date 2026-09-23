import path from "node:path";
import type { ServerConfig } from "./config.js";

export type UploadStorageArea = "uploads" | "avatars";

export function uploadStorageDirectory(
    config: ServerConfig,
    area: UploadStorageArea = "uploads",
): string {
    const configured =
        area === "avatars"
            ? config.storage.avatarDirectory
            : config.storage.uploadDirectory;
    return path.resolve(process.cwd(), configured ?? "data/uploads");
}
