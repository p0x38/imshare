import type { FastifySchema } from "fastify";

export type OpenApiHttpMethod =
    "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "TRACE";

export type OpenApiParameterLocation = "query" | "path" | "header" | "cookie";
export type OpenApiScalarType = "string" | "number" | "integer" | "boolean";
export type OpenApiSecurityRequirement = Record<string, string[]>;
export type OpenApiReference = { $ref: string };
export type OpenApiExternalDocumentation = {
    description?: string;
    url: string;
};

export type OpenApiSchema = Record<string, unknown> & {
    title?: string;
    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: boolean;
    minimum?: number;
    exclusiveMinimum?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    maxProperties?: number;
    minProperties?: number;
    required?: string[];
    enum?: unknown[];
    type?: "array" | "boolean" | "integer" | "number" | "object" | "string";
    not?: OpenApiSchema | OpenApiReference;
    allOf?: Array<OpenApiSchema | OpenApiReference>;
    oneOf?: Array<OpenApiSchema | OpenApiReference>;
    anyOf?: Array<OpenApiSchema | OpenApiReference>;
    items?: OpenApiSchema | OpenApiReference;
    properties?: Record<string, OpenApiSchema | OpenApiReference>;
    additionalProperties?: boolean | OpenApiSchema | OpenApiReference;
    description?: string;
    format?: string;
    default?: unknown;
    nullable?: boolean;
    discriminator?: OpenApiDiscriminator;
    readOnly?: boolean;
    writeOnly?: boolean;
    xml?: OpenApiXml;
    externalDocs?: OpenApiExternalDocumentation;
    example?: unknown;
    deprecated?: boolean;
};

export type OpenApiDiscriminator = {
    propertyName: string;
    mapping?: Record<string, string>;
};

export type OpenApiXml = {
    name?: string;
    namespace?: string;
    prefix?: string;
    attribute?: boolean;
    wrapped?: boolean;
};

export type OpenApiExample = {
    summary?: string;
    description?: string;
    value?: unknown;
    externalValue?: string;
};

export type OpenApiContent = Record<string, OpenApiMediaType | OpenApiReference>;

export type OpenApiParameter = {
    name: string;
    in: OpenApiParameterLocation;
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    allowEmptyValue?: boolean;
    explode?: boolean;
    style?: string;
    allowReserved?: boolean;
    schema?: OpenApiSchema | OpenApiReference;
    example?: unknown;
    examples?: Record<string, OpenApiExample | OpenApiReference>;
    content?: OpenApiContent;
};

export type OpenApiHeader = Omit<OpenApiParameter, "name" | "in">;

export type OpenApiEncoding = {
    contentType?: string;
    headers?: Record<string, OpenApiHeader | OpenApiReference>;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
};

export type OpenApiMediaType = {
    schema?: OpenApiSchema | OpenApiReference;
    example?: unknown;
    examples?: Record<string, OpenApiExample | OpenApiReference>;
    encoding?: Record<string, OpenApiEncoding>;
};

export type OpenApiRequestBody = {
    description?: string;
    required?: boolean;
    content: OpenApiContent;
};

export type OpenApiResponse = {
    description: string;
    headers?: Record<string, OpenApiHeader | OpenApiReference>;
    content?: OpenApiContent;
    links?: Record<string, OpenApiLink | OpenApiReference>;
};

export type OpenApiLink = {
    operationRef?: string;
    operationId?: string;
    parameters?: Record<string, unknown>;
    requestBody?: unknown;
    description?: string;
    server?: OpenApiServer | OpenApiReference;
};

export type OpenApiServerVariable = {
    enum?: string[];
    default: string;
    description?: string;
};

export type OpenApiServer = {
    url: string;
    description?: string;
    variables?: Record<string, OpenApiServerVariable>;
};

export type OpenApiCallback = Record<string, OpenApiPathItem | OpenApiReference>;

export type OpenApiPathItem = {
    $ref?: string;
    summary?: string;
    description?: string;
    get?: OpenApiOperation | OpenApiReference;
    put?: OpenApiOperation | OpenApiReference;
    post?: OpenApiOperation | OpenApiReference;
    delete?: OpenApiOperation | OpenApiReference;
    options?: OpenApiOperation | OpenApiReference;
    head?: OpenApiOperation | OpenApiReference;
    patch?: OpenApiOperation | OpenApiReference;
    trace?: OpenApiOperation | OpenApiReference;
    servers?: Array<OpenApiServer | OpenApiReference>;
    parameters?: Array<OpenApiParameter | OpenApiReference>;
};

export type OpenApiOperation = {
    tags?: string[];
    summary?: string;
    description?: string;
    externalDocs?: OpenApiExternalDocumentation;
    operationId?: string;
    parameters?: Array<OpenApiParameter | OpenApiReference>;
    requestBody?: OpenApiRequestBody | OpenApiReference;
    responses?: Record<string, OpenApiResponse | OpenApiReference>;
    callbacks?: Record<string, OpenApiCallback | OpenApiReference>;
    deprecated?: boolean;
    security?: OpenApiSecurityRequirement[];
    servers?: Array<OpenApiServer | OpenApiReference>;
};

export type OpenApiRouteMetadata = {
    tags?: string | string[];
    summary?: string;
    description?: string;
    externalDocs?: OpenApiExternalDocumentation;
    operationId?: string;
    parameters?: Array<OpenApiParameter | OpenApiReference>;
    requestBody?: OpenApiRequestBody | OpenApiReference;
    responses?: Record<string, OpenApiResponse | OpenApiReference>;
    callbacks?: Record<string, OpenApiCallback | OpenApiReference>;
    deprecated?: boolean;
    security?: OpenApiSecurityRequirement[];
    servers?: Array<OpenApiServer | OpenApiReference>;
    requestExample?: unknown;
    requestExamples?: Record<string, OpenApiExample | OpenApiReference>;
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

function mergeContentExample(content: OpenApiContent, example: unknown): OpenApiContent {
    const media = content["application/json"];
    const current = media && !("$ref" in media) ? media : {};
    return {
        ...content,
        "application/json": {
            ...current,
            example,
        },
    };
}

function parameterSchema(
    parameters: Array<OpenApiParameter | OpenApiReference> | undefined,
    location: OpenApiParameterLocation,
    fallback: Record<string, unknown> = {},
): Record<string, unknown> {
    const current = asRecord(fallback);
    const properties = {
        ...asRecord(current.properties),
    } as Record<string, unknown>;
    const required = new Set(
        Array.isArray(current.required)
            ? current.required.filter((value): value is string => typeof value === "string")
            : [],
    );

    for (const parameter of parameters ?? []) {
        if (!("name" in parameter) || parameter.in !== location) {
            continue;
        }

        properties[parameter.name] = parameter.schema ?? {};
        if (parameter.required) {
            required.add(parameter.name);
        }
    }

    return {
        type: "object",
        ...current,
        properties,
        ...(required.size > 0 ? { required: [...required] } : {}),
        additionalProperties: current.additionalProperties ?? true,
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
    const parameters = metadata.parameters?.filter(
        (parameter): parameter is OpenApiParameter => "name" in parameter,
    );

    return {
        ...schema,
        ...(metadata.tags
            ? { tags: Array.isArray(metadata.tags) ? metadata.tags : [metadata.tags] }
            : {}),
        ...(metadata.summary ? { summary: metadata.summary } : {}),
        ...(metadata.description ? { description: metadata.description } : {}),
        ...(metadata.operationId ? { operationId: metadata.operationId } : {}),
        params: parameterSchema(
            parameters,
            "path",
            schema.params as Record<string, unknown> | undefined,
        ),
        querystring: parameterSchema(
            parameters,
            "query",
            schema.querystring as Record<string, unknown> | undefined,
        ),
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
        const requestBody = asRecord(operation.requestBody) as OpenApiRequestBody;
        const content = (requestBody.content ?? {}) as OpenApiContent;
        const nextContent: OpenApiContent = { ...content };

        if (metadata.requestExample !== undefined) {
            const currentMedia = nextContent["application/json"];
            const media = currentMedia && !("$ref" in currentMedia) ? currentMedia : {};
            nextContent["application/json"] = {
                ...media,
                example: metadata.requestExample,
            };
        }

        if (metadata.requestExamples) {
            const currentMedia = nextContent["application/json"];
            const media = currentMedia && !("$ref" in currentMedia) ? currentMedia : {};
            nextContent["application/json"] = {
                ...media,
                examples: metadata.requestExamples,
            };
        }

        operation.requestBody = {
            ...requestBody,
            content: nextContent,
        };
    }

    if (metadata.responseExamples) {
        const responses: Record<string, OpenApiResponse> = {
            ...((operation.responses as Record<string, OpenApiResponse> | undefined) ?? {}),
        };

        for (const [status, example] of Object.entries(metadata.responseExamples)) {
            const response = responses[status] ?? { description: "Successful response." };
            const content = response.content ?? {};
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

type RequestBodyOptions = Omit<OpenApiRequestBody, "content">;
type RequestBodyOptionsOrRequired = RequestBodyOptions | boolean;

function normalizeRequestBodyOptions(options: RequestBodyOptionsOrRequired): RequestBodyOptions {
    return typeof options === "boolean" ? { required: options } : options;
}

export const request = {
    json(schema: OpenApiSchema, options: RequestBodyOptionsOrRequired = {}): OpenApiRequestBody {
        return {
            ...normalizeRequestBodyOptions(options),
            content: { "application/json": { schema } },
        };
    },

    multipart(
        schema: OpenApiSchema,
        options: RequestBodyOptionsOrRequired = {},
    ): OpenApiRequestBody {
        return {
            ...normalizeRequestBodyOptions(options),
            content: { "multipart/form-data": { schema } },
        };
    },

    form(schema: OpenApiSchema, options: RequestBodyOptionsOrRequired = {}): OpenApiRequestBody {
        return {
            ...normalizeRequestBodyOptions(options),
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
        return [{}, { [scheme]: scopes }];
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
        .map((segment, index) =>
            index === 0 ? segment : `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`,
        )
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
