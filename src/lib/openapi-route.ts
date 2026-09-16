import type { FastifySchema } from "fastify";

export type OpenApiHttpMethod =
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "HEAD"
    | "OPTIONS"
    | "TRACE";

export type OpenApiParameterLocation = "query" | "path" | "header" | "cookie";
export type OpenApiScalarType = "string" | "number" | "integer" | "boolean";
export type OpenApiSecurityRequirement = Record<string, string[]>;
export type OpenApiSchema = Record<string, unknown>;

export type OpenApiExample = {
    summary?: string;
    description?: string;
    value?: unknown;
    externalValue?: string;
};

export type OpenApiParameter = {
    name: string;
    in: OpenApiParameterLocation;
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    allowEmptyValue?: boolean;
    explode?: boolean;
    style?: string;
    schema?: OpenApiSchema;
    example?: unknown;
    examples?: Record<string, OpenApiExample>;
};

export type OpenApiHeader = {
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    schema?: OpenApiSchema;
    example?: unknown;
    examples?: Record<string, OpenApiExample>;
};

export type OpenApiMediaType = {
    schema?: OpenApiSchema;
    example?: unknown;
    examples?: Record<string, OpenApiExample>;
    encoding?: Record<string, {
        contentType?: string;
        headers?: Record<string, OpenApiHeader>;
        style?: string;
        explode?: boolean;
        allowReserved?: boolean;
    }>;
};

export type OpenApiRequestBody = {
    description?: string;
    required?: boolean;
    content: Record<string, OpenApiMediaType>;
};

export type OpenApiResponse = {
    description: string;
    headers?: Record<string, OpenApiHeader>;
    content?: Record<string, OpenApiMediaType>;
    links?: Record<string, OpenApiLink>;
};

export type OpenApiLink = {
    operationRef?: string;
    operationId?: string;
    parameters?: Record<string, unknown>;
    requestBody?: unknown;
    description?: string;
    server?: OpenApiServer;
};

export type OpenApiServer = {
    url: string;
    description?: string;
    variables?: Record<string, {
        enum?: string[];
        default: string;
        description?: string;
    }>;
};

export type OpenApiCallback = Record<string, Record<string, OpenApiSchema>>;

export type OpenApiRouteMetadata = {
    tags?: string | string[];
    summary?: string;
    description?: string;
    externalDocs?: {
        url: string;
        description?: string;
    };
    operationId?: string;
    parameters?: OpenApiParameter[];
    requestBody?: OpenApiRequestBody;
    responses?: Record<string, OpenApiResponse>;
    callbacks?: Record<string, OpenApiCallback>;
    deprecated?: boolean;
    security?: OpenApiSecurityRequirement[];
    servers?: OpenApiServer[];
    requestExample?: unknown;
    requestExamples?: Record<string, OpenApiExample>;
    responseExamples?: Record<string, unknown>;
};

export type OpenApiRouteSchema = FastifySchema & {
    "x-imshare-openapi"?: OpenApiRouteMetadata;
};

const HTTP_METHODS = new Set<OpenApiHttpMethod>([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
    "TRACE",
]);

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function mergeContentExample(
    content: Record<string, unknown>,
    example: unknown,
): Record<string, unknown> {
    const media = asRecord(content["application/json"]);
    return {
        ...content,
        "application/json": {
            ...media,
            example,
        },
    };
}

/**
 * Builds a Fastify route schema with a strongly typed OpenAPI operation attached.
 *
 * The Fastify schema remains the validation/runtime source while the private
 * extension carries OpenAPI-only objects that do not belong in JSON Schema.
 * `compileOpenApiOperation` turns that definition into the operation consumed
 * by @fastify/swagger.
 */
export function openapi(
    metadata: OpenApiRouteMetadata,
    schema: FastifySchema = {},
): OpenApiRouteSchema {
    return {
        ...schema,
        ...(metadata.tags
            ? { tags: Array.isArray(metadata.tags) ? metadata.tags : [metadata.tags] }
            : {}),
        ...(metadata.summary ? { summary: metadata.summary } : {}),
        ...(metadata.description ? { description: metadata.description } : {}),
        ...(metadata.operationId ? { operationId: metadata.operationId } : {}),
        ...(metadata.parameters ? { params: schema.params, querystring: schema.querystring } : {}),
        "x-imshare-openapi": metadata,
    };
}

/** Compile route-local metadata into an OpenAPI Operation Object. */
export function compileOpenApiOperation(
    schema: FastifySchema,
    metadata?: OpenApiRouteMetadata,
): Record<string, unknown> {
    const current = { ...asRecord(schema) };

    if (!metadata) {
        return current;
    }

    const operation = {
        ...current,
        ...(metadata.tags
            ? { tags: Array.isArray(metadata.tags) ? metadata.tags : [metadata.tags] }
            : {}),
        ...(metadata.summary ? { summary: metadata.summary } : {}),
        ...(metadata.description ? { description: metadata.description } : {}),
        ...(metadata.externalDocs ? { externalDocs: metadata.externalDocs } : {}),
        ...(metadata.operationId ? { operationId: metadata.operationId } : {}),
        ...(metadata.parameters ? { parameters: metadata.parameters } : {}),
        ...(metadata.requestBody ? { requestBody: metadata.requestBody } : {}),
        ...(metadata.responses ? { responses: metadata.responses } : {}),
        ...(metadata.callbacks ? { callbacks: metadata.callbacks } : {}),
        ...(metadata.deprecated !== undefined ? { deprecated: metadata.deprecated } : {}),
        ...(metadata.security ? { security: metadata.security } : {}),
        ...(metadata.servers ? { servers: metadata.servers } : {}),
    };

    if (metadata.requestExample !== undefined || metadata.requestExamples) {
        const requestBody = asRecord(operation.requestBody);
        const content = asRecord(requestBody.content);
        const nextContent = { ...content };

        if (metadata.requestExample !== undefined) {
            nextContent["application/json"] = {
                ...asRecord(nextContent["application/json"]),
                example: metadata.requestExample,
            };
        }

        if (metadata.requestExamples) {
            nextContent["application/json"] = {
                ...asRecord(nextContent["application/json"]),
                examples: metadata.requestExamples,
            };
        }

        operation.requestBody = {
            ...requestBody,
            content: nextContent,
        };
    }

    if (metadata.responseExamples) {
        const responses = asRecord(operation.responses);

        for (const [status, example] of Object.entries(metadata.responseExamples)) {
            const response = asRecord(responses[status]);
            const content = asRecord(response.content);
            responses[status] = {
                ...response,
                content: mergeContentExample(content, example),
            };
        }

        operation.responses = responses;
    }

    return operation;
}

export const parameter = {
    query(
        name: string,
        schema: OpenApiSchema,
        options: Omit<OpenApiParameter, "name" | "in" | "schema"> = {},
    ): OpenApiParameter {
        return { name, in: "query", schema, ...options };
    },

    path(
        name: string,
        schema: OpenApiSchema,
        options: Omit<OpenApiParameter, "name" | "in" | "required" | "schema"> = {},
    ): OpenApiParameter {
        return { name, in: "path", required: true, schema, ...options };
    },

    header(
        name: string,
        schema: OpenApiSchema,
        options: Omit<OpenApiParameter, "name" | "in" | "schema"> = {},
    ): OpenApiParameter {
        return { name, in: "header", schema, ...options };
    },

    cookie(
        name: string,
        schema: OpenApiSchema,
        options: Omit<OpenApiParameter, "name" | "in" | "schema"> = {},
    ): OpenApiParameter {
        return { name, in: "cookie", schema, ...options };
    },
};

export const request = {
    json(
        schema: OpenApiSchema,
        options: Omit<OpenApiRequestBody, "content"> = {},
    ): OpenApiRequestBody {
        return {
            ...options,
            content: { "application/json": { schema } },
        };
    },

    multipart(
        schema: OpenApiSchema,
        options: Omit<OpenApiRequestBody, "content"> = {},
    ): OpenApiRequestBody {
        return {
            ...options,
            content: { "multipart/form-data": { schema } },
        };
    },

    form(
        schema: OpenApiSchema,
        options: Omit<OpenApiRequestBody, "content"> = {},
    ): OpenApiRequestBody {
        return {
            ...options,
            content: { "application/x-www-form-urlencoded": { schema } },
        };
    },
};

export function jsonResponse(
    description: string,
    schema?: OpenApiSchema,
    example?: unknown,
    headers?: Record<string, OpenApiHeader>,
): OpenApiResponse {
    return {
        description,
        ...(headers ? { headers } : {}),
        content: {
            "application/json": {
                ...(schema ? { schema } : {}),
                ...(example !== undefined ? { example } : {}),
            },
        },
    };
}

export const response = {
    ok(schema?: OpenApiSchema, example?: unknown): OpenApiResponse {
        return schema || example !== undefined
            ? jsonResponse("Successful response.", schema, example)
            : { description: "Successful response." };
    },

    created(schema?: OpenApiSchema, example?: unknown): OpenApiResponse {
        return jsonResponse("Resource created successfully.", schema, example);
    },

    noContent(): OpenApiResponse {
        return { description: "No content." };
    },

    error(description: string, schema?: OpenApiSchema, example?: unknown): OpenApiResponse {
        return jsonResponse(description, schema, example);
    },
};

export const security = {
    required(scheme: string, scopes: string[] = []): OpenApiSecurityRequirement[] {
        return [{ [scheme]: scopes }];
    },

    optional(scheme: string, scopes: string[] = []): OpenApiSecurityRequirement[] {
        return [ {}, { [scheme]: scopes } ];
    },

    public(): OpenApiSecurityRequirement[] {
        return [];
    },
};

export function example(
    value: unknown,
    options: Omit<OpenApiExample, "value"> = {},
): OpenApiExample {
    return { ...options, value };
}

export function openapiOperationId(method: OpenApiHttpMethod | string, url: string): string {
    const normalizedMethod = method.toLowerCase();
    const path = url
        .replace(/^\/+|\/+$/g, "")
        .replace(/\{([^}]+)\}/g, "by_$1")
        .split(/[\/_-]+/)
        .filter(Boolean)
        .map((segment) => segment.replace(/[^a-zA-Z0-9]/g, ""))
        .filter(Boolean);

    return [normalizedMethod, ...path]
        .map((segment, index) => (index === 0 ? segment : segment[0]?.toUpperCase() + segment.slice(1)))
        .join("");
}

export function isOpenApiHttpMethod(value: unknown): value is OpenApiHttpMethod {
    return typeof value === "string" && HTTP_METHODS.has(value.toUpperCase() as OpenApiHttpMethod);
}

export function openapiTagForPath(url: string): string {
    const path = url.split("?", 1)[0] ?? "/";
    const segments = path.split("/").filter(Boolean);

    if (segments[0] === "api" && segments[1] === "v1") {
        switch (segments[2]) {
            case "auth":
                return "Authentication";
            case "me":
            case "users":
                return "Users";
            case "admin":
                return "Administration";
            case "health":
            case "ready":
            case "version":
                return "Instance Info";
            case "posts":
                return "Posts";
            case "comments":
                return "Comments";
            case "reports":
                return "Reports";
            case "tags":
                return "Tags";
            case "categories":
                return "Categories";
            case "uploads":
                return "Uploads";
            case "emojis":
                return "Emojis";
            case "search":
                return "Search";
            case "recommendations":
                return "Recommendations";
            default:
                return "Uncategorized";
        }
    }

    if (segments[0] === "v1") {
        return openapiTagForPath(`/api/${path}`);
    }

    if (
        path === "/.well-known/webfinger" ||
        path === "/.well-known/nodeinfo" ||
        segments[0] === "nodeinfo" ||
        segments[0] === "federation"
    ) {
        return "Federation";
    }

    return "Uncategorized";
}
