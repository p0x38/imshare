import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface ServerConfig {
    server: {
        host: string;
        port: number;
    };
    storage: {
        uploadDirectory: string;
        maxFileSize: number;
    };
    site: {
        name: string;
        version: string;
    };
    auth: {
        baseUrl?: string;
        trustedOrigins?: string[];
    };
}

const configPath = path.resolve(process.cwd(), "config.json");

export async function loadConfig(): Promise<ServerConfig> {
    const content = await readFile(configPath, "utf8");
    return parseConfig(content);
}

export function loadConfigSync(): ServerConfig {
    return parseConfig(readFileSync(configPath, "utf8"));
}

export function resolveBaseUrl(config: ServerConfig): string {
    const baseUrl = config.auth.baseUrl?.trim();

    if (!baseUrl) {
        const host =
            config.server.host.includes(":") && !config.server.host.startsWith("[")
                ? `[${config.server.host}]`
                : config.server.host;

        return `http://${host}:${config.server.port}`;
    }

    const url = new URL(baseUrl);

    if (hasExplicitPort(baseUrl)) {
        return baseUrl.replace(/\/+$/, "");
    }

    url.port = String(config.server.port);
    return url.toString().replace(/\/$/, "");
}

function hasExplicitPort(value: string): boolean {
    const authority = value.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1];

    if (!authority) return false;

    const host = authority.slice(authority.lastIndexOf("@") + 1);

    if (host.startsWith("[")) {
        return /^\[[^\]]+\]:\d+$/.test(host);
    }

    return /:\d+$/.test(host);
}

function parseConfig(content: string): ServerConfig {
    const config: unknown = JSON.parse(content);

    if (!isServerConfig(config)) {
        throw new Error(`Invalid server configuration: ${configPath}`);
    }

    return config;
}

function isServerConfig(value: unknown): value is ServerConfig {
    if (!value || typeof value !== "object") return false;

    const config = value as Record<string, unknown>;
    const server = config.server;
    const storage = config.storage;
    const site = config.site;
    const auth = config.auth;

    return (
        isObject(server) &&
        typeof server.host === "string" &&
        typeof server.port === "number" &&
        Number.isInteger(server.port) &&
        server.port > 0 &&
        server.port <= 65535 &&
        isObject(storage) &&
        typeof storage.uploadDirectory === "string" &&
        storage.uploadDirectory.length > 0 &&
        typeof storage.maxFileSize === "number" &&
        Number.isInteger(storage.maxFileSize) &&
        storage.maxFileSize > 0 &&
        isObject(site) &&
        typeof site.name === "string" &&
        typeof site.version === "string" &&
        isObject(auth) &&
        (auth.baseUrl === undefined ||
            (typeof auth.baseUrl === "string" && auth.baseUrl.length > 0)) &&
        (auth.trustedOrigins === undefined ||
            (Array.isArray(auth.trustedOrigins) &&
                auth.trustedOrigins.every(
                    (origin): origin is string => typeof origin === "string" && origin.length > 0,
                )))
    );
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
