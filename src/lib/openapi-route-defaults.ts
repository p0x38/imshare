import type { FastifyInstance, FastifySchema } from "fastify";
import {
    openapiOperationId,
    openapiTagForPath,
    type OpenApiExample,
    type OpenApiParameter,
    type OpenApiRequestBody,
    type OpenApiSchema,
    type OpenApiSecurityRequirement,
} from "./openapi-route.js";

const API_PREFIXES = ["/api/v1/", "/v1/"] as const;
const PUBLIC_PREFIXES = [
    "/health",
    "/ready",
    "/version",
    "/config",
    "/users",
    "/tags",
    "/categories",
    "/posts",
    "/search",
    "/emojis",
    "/recommendations",
    "/posts/image/",
] as const;

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stripApiPrefix(url: string): string {
    const path = url.split("?", 1)[0] ?? "/";
    if (path.startsWith("/api/v1")) return path.slice("/api".length) || "/";
    return path;
}

function isApiRoute(url: string): boolean {
    const path = url.split("?", 1)[0] ?? "/";
    return API_PREFIXES.some((prefix) => path.startsWith(prefix) || path === prefix.slice(0, -1));
}

function humanizeSegment(segment: string): string {
    return segment
        .replace(/^[:{}]/, "")
        .replace(/[{}]/g, "")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function defaultSummary(method: string, url: string): string {
    const path = stripApiPrefix(url).replace(/^\/|\/$/g, "");
    const segments = path.split("/").filter(Boolean);
    const meaningful = segments.filter(
        (segment) => !/^v\d+$/.test(segment) && !/^[:{]/.test(segment),
    );
    const resource = meaningful.at(-1) ?? "resource";
    const collection = meaningful.at(-2);

    switch (method.toUpperCase()) {
        case "GET":
            return collection && /^[:{]/.test(resource)
                ? `Get ${humanizeSegment(collection)}`
                : `Get ${humanizeSegment(resource)}`;
        case "POST":
            return `Create ${humanizeSegment(resource)}`;
        case "PUT":
            return `Replace ${humanizeSegment(resource)}`;
        case "PATCH":
            return `Update ${humanizeSegment(resource)}`;
        case "DELETE":
            return `Delete ${humanizeSegment(resource)}`;
        case "HEAD":
            return `Inspect ${humanizeSegment(resource)}`;
        case "OPTIONS":
            return `Get ${humanizeSegment(resource)} options`;
        case "TRACE":
            return `Trace ${humanizeSegment(resource)}`;
        default:
            return `${method.toUpperCase()} ${path}`;
    }
}

function defaultDescription(method: string, url: string): string {
    const path = stripApiPrefix(url);
    return `HTTP ${method.toUpperCase()} operation for ${path}. The endpoint follows the imshare API contract and uses the route's Fastify schema for validation where available.`;
}

function schemaObject(value: unknown): OpenApiSchema | undefined {
    const source = asRecord(value);
    if (Object.keys(source).length === 0) return undefined;

    const output: OpenApiSchema = { ...source };
    const properties = source.properties;
    if (properties && typeof properties === "object") {
        output.properties = Object.fromEntries(
            Object.entries(asRecord(properties)).map(([name, property]) => {
                const normalized = schemaObject(property);
                return [name, normalized ?? (property as OpenApiSchema)];
            }),
        );
    }
    if (source.items) output.items = schemaObject(source.items) ?? (source.items as OpenApiSchema);
    if (source.additionalProperties && typeof source.additionalProperties === "object") {
        output.additionalProperties =
            schemaObject(source.additionalProperties) ??
            (source.additionalProperties as OpenApiSchema);
    }
    for (const key of ["allOf", "oneOf", "anyOf"] as const) {
        const valueItems = source[key];
        if (Array.isArray(valueItems)) {
            output[key] = valueItems.map((item) => schemaObject(item) ?? (item as OpenApiSchema));
        }
    }
    return output;
}

function schemaParameter(
    name: string,
    location: "query" | "path" | "header" | "cookie",
    schema: OpenApiSchema | undefined,
    required: boolean,
): OpenApiParameter {
    return {
        name,
        in: location,
        required: location === "path" ? true : required,
        schema: schema ?? { type: "string" },
    };
}

function parametersFromObjectSchema(
    location: "query" | "path" | "header" | "cookie",
    value: unknown,
): OpenApiParameter[] {
    const schema = asRecord(value);
    const properties = asRecord(schema.properties);
    const required = new Set(
        Array.isArray(schema.required)
            ? schema.required.filter((item): item is string => typeof item === "string")
            : [],
    );

    return Object.entries(properties).map(([name, property]) =>
        schemaParameter(name, location, schemaObject(property), required.has(name)),
    );
}

function pathParameterNames(url: string): string[] {
    const names = new Set<string>();
    const path = stripApiPrefix(url);
    for (const match of path.matchAll(/:(\w+)/g)) names.add(match[1]!);
    for (const match of path.matchAll(/\{([^}]+)\}/g)) names.add(match[1]!);
    return [...names];
}

function fallbackQueryParameters(url: string): OpenApiParameter[] {
    const path = stripApiPrefix(url);
    const parameters: OpenApiParameter[] = [];

    const add = (
        name: string,
        schema: OpenApiSchema,
        options: Omit<OpenApiParameter, "name" | "in" | "schema"> = {},
    ) => {
        parameters.push({ name, in: "query", schema, ...options });
    };

    if (
        path.includes("/posts") ||
        path.includes("/users") ||
        path.includes("/tags") ||
        path.includes("/categories") ||
        path.includes("/comments") ||
        path.includes("/notifications") ||
        path.includes("/sessions") ||
        path.includes("/recommendations")
    ) {
        add(
            "page",
            { type: "integer", minimum: 1, default: 1 },
            { description: "1-based page number." },
        );
        add(
            "limit",
            { type: "integer", minimum: 1, maximum: 100, default: 20 },
            { description: "Maximum number of items to return." },
        );
        add(
            "order",
            { type: "string", enum: ["asc", "desc"], default: "desc" },
            { description: "Sort direction." },
        );
    }

    if (path === "/posts" || path === "/search") {
        add("search", { type: "string", minLength: 1 }, { description: "Search text." });
    }
    if (path === "/posts") {
        add("user", { type: "string" }, { description: "Filter posts by user ID." });
        add("tag", { type: "string" }, { description: "Filter posts by tag slug." });
        add("category", { type: "string" }, { description: "Filter posts by category ID." });
    }
    if (path === "/search") {
        add(
            "q",
            { type: "string", minLength: 1 },
            { required: true, description: "Search query." },
        );
        add(
            "type",
            {
                type: "string",
                enum: ["all", "posts", "users", "tags", "categories"],
                default: "all",
            },
            { description: "Search target type." },
        );
        add("user", { type: "string" }, { description: "Filter search results by user ID." });
        add("tag", { type: "string" }, { description: "Filter search results by tag slug." });
        add(
            "category",
            { type: "string" },
            { description: "Filter search results by category ID." },
        );
    }
    if (path.startsWith("/posts/image/") && !path.endsWith("/placeholder")) {
        add(
            "width",
            { type: "integer", minimum: 16, maximum: 4096 },
            { description: "Requested output width." },
        );
        add(
            "height",
            { type: "integer", minimum: 16, maximum: 4096 },
            { description: "Requested output height." },
        );
        add(
            "fit",
            {
                type: "string",
                enum: ["cover", "contain", "fill", "inside", "outside"],
                default: "inside",
            },
            { description: "Resize fit mode." },
        );
        add(
            "format",
            { type: "string", enum: ["webp", "jpeg", "jpg", "png", "avif"] },
            { description: "Optional output image format." },
        );
        add(
            "download",
            { type: "boolean", default: false },
            { description: "Request download disposition." },
        );
    }
    if (path === "/uploads") {
        add(
            "multiple",
            { type: "boolean", default: false },
            { description: "Upload up to 20 files instead of one." },
        );
    }
    if (path === "/admin/users") {
        add("search", { type: "string" }, { description: "Search by user fields." });
        add("role", { type: "string" }, { description: "Filter by user role." });
        add("banned", { type: "boolean" }, { description: "Filter by banned status." });
    }
    if (path === "/admin/reports") {
        add(
            "status",
            { type: "string", enum: ["open", "resolved", "dismissed"], default: "open" },
            { description: "Filter moderation reports by status." },
        );
    }

    return parameters;
}

function inferredParameters(url: string, schema: FastifySchema): OpenApiParameter[] {
    const parameters: OpenApiParameter[] = [];
    const explicit = Array.isArray((schema as Record<string, unknown>).parameters)
        ? ((schema as Record<string, unknown>).parameters as OpenApiParameter[])
        : [];

    parameters.push(...explicit);

    const pathNames = pathParameterNames(url);
    const pathSchema = parametersFromObjectSchema(
        "path",
        (schema as Record<string, unknown>).params,
    );
    for (const name of pathNames) {
        if (!parameters.some((parameter) => parameter.name === name && parameter.in === "path")) {
            const defined = pathSchema.find((parameter) => parameter.name === name);
            parameters.push(defined ?? schemaParameter(name, "path", undefined, true));
        }
    }

    const querySchema = parametersFromObjectSchema(
        "query",
        (schema as Record<string, unknown>).querystring,
    );
    const headerSchema = parametersFromObjectSchema(
        "header",
        (schema as Record<string, unknown>).headers,
    );
    const cookieSchema = parametersFromObjectSchema(
        "cookie",
        (schema as Record<string, unknown>).cookies,
    );

    for (const candidate of [
        ...querySchema,
        ...headerSchema,
        ...cookieSchema,
        ...fallbackQueryParameters(url),
    ]) {
        if (
            !parameters.some(
                (parameter) => parameter.name === candidate.name && parameter.in === candidate.in,
            )
        )
            parameters.push(candidate);
    }

    return parameters;
}

function inferredRequestBody(
    method: string,
    url: string,
    schema: FastifySchema,
): OpenApiRequestBody | undefined {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) return undefined;
    const current = (schema as Record<string, unknown>).requestBody;
    if (current && typeof current === "object") return current as OpenApiRequestBody;

    const body = (schema as Record<string, unknown>).body;
    if (body && typeof body === "object") {
        return {
            required: true,
            content: {
                "application/json": { schema: schemaObject(body) ?? (body as OpenApiSchema) },
            },
        };
    }

    const path = stripApiPrefix(url);
    const definitions: Record<string, OpenApiRequestBody> = {
        "/me/preferences": {
            required: false,
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        properties: {
                            isPublic: { type: "boolean" },
                            followApprovalRequired: { type: "boolean" },
                            showEmail: { type: "boolean" },
                            showPosts: { type: "boolean" },
                            showProfile: { type: "boolean" },
                            showHandle: { type: "boolean" },
                            showFollowers: { type: "boolean" },
                            showFollowings: { type: "boolean" },
                            allowSearchEngineIndex: { type: "boolean" },
                            defaultCategoryId: { type: "string", nullable: true },
                            defaultPostVisibility: {
                                type: "string",
                                enum: ["public", "unlisted", "private"],
                            },
                            defaultAllowDownload: { type: "boolean" },
                            defaultContentWarning: {
                                type: "string",
                                maxLength: 500,
                                nullable: true,
                            },
                        },
                    },
                },
            },
        },
    };

    if (path === "/uploads") {
        return {
            required: true,
            content: {
                "multipart/form-data": {
                    schema: {
                        type: "object",
                        required: ["file"],
                        properties: {
                            file: { type: "string", format: "binary" },
                        },
                    },
                },
            },
        };
    }

    return definitions[path];
}

function publicOperation(path: string): boolean {
    return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function inferredSecurity(method: string, url: string): OpenApiSecurityRequirement[] | undefined {
    const path = stripApiPrefix(url);
    if (path.startsWith("/auth/")) return undefined;
    if (path === "/posts/{postId}/reactions" || path.match(/^\/posts\/[^/]+\/reactions$/))
        return [{}, { cookieAuth: [] }];
    if (publicOperation(path) && method.toUpperCase() === "GET") return [];
    return [{ cookieAuth: [] }];
}

function inferredExample(schema: unknown): OpenApiExample | undefined {
    const source = asRecord(schema);
    if (source.example !== undefined) return { summary: "Example value", value: source.example };
    if (Array.isArray(source.examples) && source.examples[0] !== undefined)
        return { summary: "Example value", value: source.examples[0] };
    if (source.default !== undefined) return { summary: "Default value", value: source.default };
    if (Array.isArray(source.enum) && source.enum.length > 0)
        return { summary: "Example value", value: source.enum[0] };
    return undefined;
}

/**
 * Installs a route-time OpenAPI enrichment layer before API routes are registered.
 * Explicit Fastify schemas and `x-imshare-openapi` metadata remain authoritative;
 * generated values only fill fields that are otherwise missing.
 */
export function installOpenApiRouteDefaults(fastify: FastifyInstance): void {
    fastify.addHook("onRoute", (route) => {
        if (!isApiRoute(route.url)) return;

        const schema = { ...((route.schema ?? {}) as FastifySchema) } as FastifySchema &
            Record<string, unknown>;
        const method = typeof route.method === "string" ? route.method.toUpperCase() : "GET";
        const path = stripApiPrefix(route.url);

        if (!schema.operationId) schema.operationId = openapiOperationId(method, path);
        if (!schema.summary) schema.summary = defaultSummary(method, path);
        if (!schema.description) schema.description = defaultDescription(method, path);
        if (!schema.tags) schema.tags = [openapiTagForPath(path)];

        const parameters = inferredParameters(path, schema);
        if (parameters.length > 0) schema.parameters = parameters;

        const requestBody = inferredRequestBody(method, path, schema);
        if (requestBody && !schema.requestBody) schema.requestBody = requestBody;

        const security = inferredSecurity(method, path);
        if (security !== undefined && schema.security === undefined) schema.security = security;

        const currentResponses = asRecord(schema.responses) as Record<string, unknown>;
        if (
            Object.keys(currentResponses).length === 0 &&
            method !== "HEAD" &&
            method !== "OPTIONS"
        ) {
            schema.responses = {
                "400": { $ref: "#/components/responses/BadRequest" },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                ...(path.includes("{") || path.includes(":")
                    ? { "404": { $ref: "#/components/responses/NotFound" } }
                    : {}),
                ...(method !== "GET" ? { "409": { $ref: "#/components/responses/Conflict" } } : {}),
                "429": { $ref: "#/components/responses/TooManyRequests" },
                "500": { $ref: "#/components/responses/InternalServerError" },
            };
        }

        const bodyExample = inferredExample((schema as Record<string, unknown>).body);
        if (bodyExample && !schema.requestBody) {
            schema.requestBody = {
                required: true,
                content: { "application/json": { examples: { default: bodyExample } } },
            };
        }

        route.schema = schema;
    });
}
