import { mkdir } from "node:fs/promises";
import path from "node:path";

export function resolveCacheDirectory(): string {
    return path.resolve(process.cwd(), "cache");
}

export async function ensureCacheDirectory(): Promise<string> {
    const directory = resolveCacheDirectory();
    await mkdir(directory, { recursive: true });
    return directory;
}
