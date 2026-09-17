import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseConfigDsl, stringifyConfigDsl } from "./config-dsl.js";
import { getOpenIdProviderId } from "./openid.js";

export type RegistrationMode = "disabled" | "open" | "token" | "approval";

export interface ServerConfig {
    server: { host: string; port: number };
    storage: { uploadDirectory: string; maxFileSize: number };
    site: { name: string; version: string; description?: string };
    auth: {
        baseUrl?: string;
        appendPort?: boolean;
        trustedOrigins?: string[];
        emailAndPasswordEnabled?: boolean;
        registration?: { enabled?: boolean; public?: boolean; manualApproval?: boolean };
    };
    features?: {
        imagePosts?: boolean;
        textPosts?: boolean;
        comments?: boolean;
        reactions?: boolean;
        reports?: boolean;
        recommendations?: boolean;
        notifications?: boolean;
        search?: boolean;
        publicProfiles?: boolean;
        publicPosts?: boolean;
        apiDocs?: boolean;
        sitemap?: boolean;
        robots?: boolean;
    };
    limits?: { textPostCharacters?: number };
    analytics?: { googleAnalyticsMeasurementId?: string; googleTagManagerContainerId?: string };
}

export interface PublicConfig {
    site: { name: string; version: string; description: string };
    auth: {
        emailAndPasswordEnabled: boolean;
        registration: {
            enabled: boolean;
            public: boolean;
            tokenRequired: boolean;
            approvalRequired: boolean;
        };
        oidcProviderId: string | null;
    };
    features: Required<NonNullable<ServerConfig["features"]>>;
    limits: { textPostCharacters: number };
}

const CONFIG_FILE = process.env.IMSHARE_CONFIG?.trim() || "config.imshare";
const configPath = path.resolve(process.cwd(), CONFIG_FILE);
const DEFAULTS = {
    site: { description: "Self-hosted image archive and sharing server" },
    auth: {
        emailAndPasswordEnabled: true,
        appendPort: true,
        registration: { enabled: true, public: false, manualApproval: false },
    },
    features: {
        imagePosts: true,
        textPosts: true,
        comments: true,
        reactions: true,
        reports: true,
        recommendations: true,
        notifications: true,
        search: true,
        publicProfiles: true,
        publicPosts: true,
        apiDocs: true,
        sitemap: true,
        robots: true,
    },
    limits: { textPostCharacters: 500 },
} as const;

export async function loadConfig(): Promise<ServerConfig> {
    return parseConfig(await readFile(configPath, "utf8"));
}

export function loadConfigSync(): ServerConfig {
    return parseConfig(readFileSync(configPath, "utf8"));
}

export async function updateConfig(
    update: (config: ServerConfig) => ServerConfig,
): Promise<ServerConfig> {
    const next = normalizeConfig(update(await loadConfig()));
    if (!isServerConfig(next)) throw new Error(`Invalid server configuration: ${configPath}`);
    await writeFile(configPath, stringifyConfigDsl(next), "utf8");
    return next;
}

export const getConfig = loadConfig;
export async function saveConfig(config: ServerConfig): Promise<ServerConfig> {
    return updateConfig(() => config);
}

export function getPublicConfig(config: ServerConfig): PublicConfig {
    const normalized = normalizeConfig(config);
    const registration = normalized.auth.registration!;
    return {
        site: {
            name: normalized.site.name,
            version: normalized.site.version,
            description: normalized.site.description!,
        },
        auth: {
            emailAndPasswordEnabled: normalized.auth.emailAndPasswordEnabled!,
            registration: {
                enabled: registration.enabled!,
                public: registration.public!,
                tokenRequired: registration.enabled! && !registration.public! && !registration.manualApproval!,
                approvalRequired: registration.enabled! && registration.manualApproval!,
            },
            oidcProviderId: getOpenIdProviderId(),
        },
        features: normalized.features as PublicConfig["features"],
        limits: { textPostCharacters: normalized.limits!.textPostCharacters! },
    };
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
    if (hasExplicitPort(baseUrl) || config.auth.appendPort === false) {
        return baseUrl.replace(/\/+$/, "");
    }
    url.port = String(config.server.port);
    return url.toString().replace(/\/$/, "");
}

function hasExplicitPort(value: string): boolean {
    const authority = value.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1];
    if (!authority) return false;
    const host = authority.slice(authority.lastIndexOf("@") + 1);
    return host.startsWith("[") ? /^\[[^\]]+\]:\d+$/.test(host) : /:\d+$/.test(host);
}

function parseConfig(content: string): ServerConfig {
    const config = parseConfigDsl(content);
    if (!isServerConfig(config)) throw new Error(`Invalid server configuration: ${configPath}`);
    return normalizeConfig(config);
}

function normalizeConfig(config: ServerConfig): ServerConfig {
    return {
        ...config,
        site: { ...config.site, description: config.site.description ?? DEFAULTS.site.description },
        auth: {
            ...config.auth,
            emailAndPasswordEnabled:
                config.auth.emailAndPasswordEnabled ?? DEFAULTS.auth.emailAndPasswordEnabled,
            appendPort: config.auth.appendPort ?? DEFAULTS.auth.appendPort,
            registration: { ...DEFAULTS.auth.registration, ...config.auth.registration },
        },
        features: { ...DEFAULTS.features, ...config.features },
        limits: { ...DEFAULTS.limits, ...config.limits },
    };
}

function isServerConfig(value: unknown): value is ServerConfig {
    if (!value || typeof value !== "object") return false;
    const config = value as Record<string, unknown>;
    const server = config.server,
        storage = config.storage,
        site = config.site,
        auth = config.auth,
        features = config.features,
        limits = config.limits,
        analytics = config.analytics;
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
        (site.description === undefined || typeof site.description === "string") &&
        isObject(auth) &&
        (auth.baseUrl === undefined ||
            (typeof auth.baseUrl === "string" && auth.baseUrl.length > 0)) &&
        (auth.appendPort === undefined || typeof auth.appendPort === "boolean") &&
        (auth.trustedOrigins === undefined ||
            (Array.isArray(auth.trustedOrigins) &&
                auth.trustedOrigins.every(
                    (origin) => typeof origin === "string" && origin.length > 0,
                ))) &&
        (auth.emailAndPasswordEnabled === undefined ||
            typeof auth.emailAndPasswordEnabled === "boolean") &&
        (auth.registration === undefined ||
            (isObject(auth.registration) &&
                (auth.registration.enabled === undefined ||
                    typeof auth.registration.enabled === "boolean") &&
                (auth.registration.public === undefined ||
                    typeof auth.registration.public === "boolean") &&
                (auth.registration.manualApproval === undefined ||
                    typeof auth.registration.manualApproval === "boolean"))) &&
        (features === undefined ||
            (isObject(features) &&
                Object.values(features).every((flag) => typeof flag === "boolean"))) &&
        (limits === undefined ||
            (isObject(limits) &&
                (limits.textPostCharacters === undefined ||
                    (typeof limits.textPostCharacters === "number" &&
                        Number.isInteger(limits.textPostCharacters) &&
                        limits.textPostCharacters > 0)))) &&
        (analytics === undefined ||
            (isObject(analytics) &&
                (analytics.googleAnalyticsMeasurementId === undefined ||
                    typeof analytics.googleAnalyticsMeasurementId === "string") &&
                (analytics.googleTagManagerContainerId === undefined ||
                    typeof analytics.googleTagManagerContainerId === "string")))
    );
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
