import { readFileSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseConfigDsl, stringifyConfigDsl } from "./config-dsl.js";
import { getOpenIdProviderId } from "./openid.js";

export type RegistrationMode = "disabled" | "open" | "token" | "approval";

export interface ServerConfig {
    server: { host: string; port: number };
    storage: { uploadDirectory: string; maxFileSize: number };
    site: { name: string; version: string; description?: string };
    admin?: {
        local?: {
            enabled?: boolean;
            host?: string;
            port?: number;
        };
    };
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
    federation?: {
        enabled?: boolean;
        incomingEnabled?: boolean;
        outgoingEnabled?: boolean;
        publicDiscovery?: boolean;
        sharedInboxEnabled?: boolean;
        deliveryTimeoutMs?: number;
        remoteFetchTimeoutMs?: number;
    };
    p2p?: {
        enabled?: boolean;
        incomingEnabled?: boolean;
        outgoingEnabled?: boolean;
        signalingUrl?: string;
        discovery?: "manual" | "signaling";
        iceServers?: string[];
    };
    observability?: {
        enabled?: boolean;
        serviceName?: string;
        serviceVersion?: string;
        environment?: string;
        instanceId?: string;
        batch?: {
            exportIntervalMs?: number;
            maxExportBatchSize?: number;
            maxQueueSize?: number;
        };
        traces?: {
            enabled?: boolean;
            endpoint?: string;
            protocol?: "grpc" | "http/protobuf";
            samplingRatio?: number;
        };
        metrics?: {
            enabled?: boolean;
            exportIntervalMs?: number;
            prometheus?: { enabled?: boolean; path?: string };
            otlp?: {
                enabled?: boolean;
                endpoint?: string;
                protocol?: "grpc" | "http/protobuf";
            };
        };
        logs?: {
            enabled?: boolean;
            includeTraceContext?: boolean;
            otlp?: {
                enabled?: boolean;
                endpoint?: string;
                protocol?: "grpc" | "http/protobuf";
            };
        };
    };
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
    admin: { local: { enabled: true, host: "127.0.0.1", port: 5107 } },
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
    federation: {
        enabled: true,
        incomingEnabled: true,
        outgoingEnabled: true,
        publicDiscovery: true,
        sharedInboxEnabled: true,
        deliveryTimeoutMs: 10_000,
        remoteFetchTimeoutMs: 10_000,
    },
    p2p: {
        enabled: false,
        incomingEnabled: false,
        outgoingEnabled: false,
        discovery: "manual",
        iceServers: [],
    },
} as const;

export async function readConfigText(): Promise<string> {
    return readFile(configPath, "utf8");
}

export function validateConfigText(content: string): ServerConfig {
    return parseConfig(content);
}

export async function saveConfigText(content: string): Promise<ServerConfig> {
    const validated = validateConfigText(content);
    const temporaryPath = `${configPath}.tmp`;
    await writeFile(temporaryPath, content.trimEnd() + "\n", "utf8");
    await rename(temporaryPath, configPath);
    return validated;
}

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
                tokenRequired:
                    registration.enabled! && !registration.public! && !registration.manualApproval!,
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
        admin: {
            ...DEFAULTS.admin,
            ...config.admin,
            local: { ...DEFAULTS.admin.local, ...config.admin?.local },
        },
        auth: {
            ...config.auth,
            emailAndPasswordEnabled:
                config.auth.emailAndPasswordEnabled ?? DEFAULTS.auth.emailAndPasswordEnabled,
            appendPort: config.auth.appendPort ?? DEFAULTS.auth.appendPort,
            registration: { ...DEFAULTS.auth.registration, ...config.auth.registration },
        },
        features: { ...DEFAULTS.features, ...config.features },
        limits: { ...DEFAULTS.limits, ...config.limits },
        federation: { ...DEFAULTS.federation, ...config.federation },
        p2p: { ...DEFAULTS.p2p, ...config.p2p },
    };
}

function isServerConfig(value: unknown): value is ServerConfig {
    if (!value || typeof value !== "object") return false;
    const config = value as Record<string, unknown>;
    const server = config.server,
        storage = config.storage,
        site = config.site,
        admin = config.admin,
        auth = config.auth,
        features = config.features,
        limits = config.limits,
        analytics = config.analytics,
        federation = config.federation,
        p2p = config.p2p,
        observability = config.observability;
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
        (admin === undefined || (isObject(admin) && (admin.local === undefined || (isObject(admin.local) &&
            (admin.local.enabled === undefined || typeof admin.local.enabled === "boolean") &&
            (admin.local.host === undefined || admin.local.host === "127.0.0.1") &&
            (admin.local.port === undefined || (typeof admin.local.port === "number" && Number.isInteger(admin.local.port) && admin.local.port > 0 && admin.local.port <= 65535)) &&
            (admin.local.port === undefined || admin.local.port !== server.port))))) &&
        (admin === undefined ||
            (isObject(admin) &&
                (admin.local === undefined ||
                    (isObject(admin.local) &&
                        (admin.local.enabled === undefined || typeof admin.local.enabled === "boolean") &&
                        (admin.local.host === undefined ||
                            admin.local.host === "127.0.0.1" ||
                            admin.local.host === "localhost" ||
                            admin.local.host === "::1") &&
                        (admin.local.port === undefined ||
                            (typeof admin.local.port === "number" &&
                                Number.isInteger(admin.local.port) &&
                                admin.local.port > 0 &&
                                admin.local.port <= 65535)) &&
                        (admin.local.port === undefined || admin.local.port !== server.port))))) &&
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
                    typeof analytics.googleTagManagerContainerId === "string"))) &&
        (federation === undefined ||
            (isObject(federation) &&
                (federation.enabled === undefined || typeof federation.enabled === "boolean") &&
                (federation.incomingEnabled === undefined || typeof federation.incomingEnabled === "boolean") &&
                (federation.outgoingEnabled === undefined || typeof federation.outgoingEnabled === "boolean") &&
                (federation.publicDiscovery === undefined || typeof federation.publicDiscovery === "boolean") &&
                (federation.sharedInboxEnabled === undefined || typeof federation.sharedInboxEnabled === "boolean") &&
                (federation.deliveryTimeoutMs === undefined || (typeof federation.deliveryTimeoutMs === "number" && Number.isFinite(federation.deliveryTimeoutMs) && federation.deliveryTimeoutMs > 0)) &&
                (federation.remoteFetchTimeoutMs === undefined || (typeof federation.remoteFetchTimeoutMs === "number" && Number.isFinite(federation.remoteFetchTimeoutMs) && federation.remoteFetchTimeoutMs > 0)))) &&
        (p2p === undefined ||
            (isObject(p2p) &&
                (p2p.enabled === undefined || typeof p2p.enabled === "boolean") &&
                (p2p.incomingEnabled === undefined || typeof p2p.incomingEnabled === "boolean") &&
                (p2p.outgoingEnabled === undefined || typeof p2p.outgoingEnabled === "boolean") &&
                (p2p.signalingUrl === undefined || typeof p2p.signalingUrl === "string") &&
                (p2p.discovery === undefined || p2p.discovery === "manual" || p2p.discovery === "signaling") &&
                (p2p.iceServers === undefined || (Array.isArray(p2p.iceServers) && p2p.iceServers.every((server) => typeof server === "string" && server.length > 0))))) &&
        (observability === undefined ||
            (isObject(observability) &&
                (observability.enabled === undefined ||
                    typeof observability.enabled === "boolean") &&
                (observability.serviceName === undefined ||
                    typeof observability.serviceName === "string") &&
                (observability.serviceVersion === undefined ||
                    typeof observability.serviceVersion === "string") &&
                (observability.environment === undefined ||
                    typeof observability.environment === "string") &&
                (observability.instanceId === undefined ||
                    typeof observability.instanceId === "string") &&
                (observability.batch === undefined ||
                    (isObject(observability.batch) &&
                        (observability.batch.exportIntervalMs === undefined ||
                            typeof observability.batch.exportIntervalMs === "number") &&
                        (observability.batch.maxExportBatchSize === undefined ||
                            typeof observability.batch.maxExportBatchSize === "number") &&
                        (observability.batch.maxQueueSize === undefined ||
                            typeof observability.batch.maxQueueSize === "number"))) &&
                (observability.traces === undefined ||
                    (isObject(observability.traces) &&
                        (observability.traces.enabled === undefined ||
                            typeof observability.traces.enabled === "boolean") &&
                        (observability.traces.endpoint === undefined ||
                            typeof observability.traces.endpoint === "string") &&
                        (observability.traces.protocol === undefined ||
                            observability.traces.protocol === "grpc" ||
                            observability.traces.protocol === "http/protobuf") &&
                        (observability.traces.samplingRatio === undefined ||
                            typeof observability.traces.samplingRatio === "number"))) &&
                (observability.metrics === undefined ||
                    (isObject(observability.metrics) &&
                        (observability.metrics.enabled === undefined ||
                            typeof observability.metrics.enabled === "boolean") &&
                        (observability.metrics.exportIntervalMs === undefined ||
                            typeof observability.metrics.exportIntervalMs === "number") &&
                        (observability.metrics.prometheus === undefined ||
                            (isObject(observability.metrics.prometheus) &&
                                (observability.metrics.prometheus.enabled === undefined ||
                                    typeof observability.metrics.prometheus.enabled ===
                                        "boolean") &&
                                (observability.metrics.prometheus.path === undefined ||
                                    typeof observability.metrics.prometheus.path === "string"))) &&
                        (observability.metrics.otlp === undefined ||
                            (isObject(observability.metrics.otlp) &&
                                (observability.metrics.otlp.enabled === undefined ||
                                    typeof observability.metrics.otlp.enabled === "boolean") &&
                                (observability.metrics.otlp.endpoint === undefined ||
                                    typeof observability.metrics.otlp.endpoint === "string") &&
                                (observability.metrics.otlp.protocol === undefined ||
                                    observability.metrics.otlp.protocol === "grpc" ||
                                    observability.metrics.otlp.protocol === "http/protobuf"))))) &&
                (observability.logs === undefined ||
                    (isObject(observability.logs) &&
                        (observability.logs.enabled === undefined ||
                            typeof observability.logs.enabled === "boolean") &&
                        (observability.logs.includeTraceContext === undefined ||
                            typeof observability.logs.includeTraceContext === "boolean") &&
                        (observability.logs.otlp === undefined ||
                            (isObject(observability.logs.otlp) &&
                                (observability.logs.otlp.enabled === undefined ||
                                    typeof observability.logs.otlp.enabled === "boolean") &&
                                (observability.logs.otlp.endpoint === undefined ||
                                    typeof observability.logs.otlp.endpoint === "string") &&
                                (observability.logs.otlp.protocol === undefined ||
                                    observability.logs.otlp.protocol === "grpc" ||
                                    observability.logs.otlp.protocol === "http/protobuf")))))))
    );
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
