const dateTime = { type: "string", format: "date-time" } as const;

export const errorResponseSchema = {
    type: "object",
    additionalProperties: false,
    required: ["error", "endpoint"],
    properties: {
        error: {
            type: "object",
            additionalProperties: false,
            required: ["code", "message"],
            properties: { code: { type: "string" }, message: { type: "string" } },
        },
        endpoint: { type: "string" },
    },
} as const;

export const postSchema = {
    type: "object",
    additionalProperties: false,
    required: [
        "id",
        "title",
        "description",
        "caption",
        "sourceUrl",
        "originalCreator",
        "originalCreatedAt",
        "allowDownload",
        "status",
        "visibility",
        "publishedAt",
        "scheduledAt",
        "hiddenAt",
        "contentWarning",
        "createdAt",
        "updatedAt",
        "author",
        "authorName",
        "viewCount",
        "category",
        "tags",
        "uploads",
        "reactions",
    ],
    properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { anyOf: [{ type: "string" }, { type: "null" }] },
        caption: { anyOf: [{ type: "string" }, { type: "null" }] },
        sourceUrl: { anyOf: [{ type: "string" }, { type: "null" }] },
        originalCreator: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] },
        originalCreatedAt: { anyOf: [dateTime, { type: "null" }] },
        allowDownload: { type: "boolean" },
        status: { type: "string", enum: ["draft", "published"] },
        visibility: { type: "string", enum: ["public", "unlisted", "private"] },
        publishedAt: { anyOf: [dateTime, { type: "null" }] },
        scheduledAt: { anyOf: [dateTime, { type: "null" }] },
        hiddenAt: { anyOf: [dateTime, { type: "null" }] },
        contentWarning: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] },
        createdAt: dateTime,
        updatedAt: dateTime,
        author: {
            type: "object",
            additionalProperties: false,
            required: ["id", "name", "image", "updatedAt", "avatarUrl"],
            properties: {
                id: { type: "string" },
                name: { type: "string" },
                image: { anyOf: [{ type: "string" }, { type: "null" }] },
                updatedAt: dateTime,
                avatarUrl: { type: "string" },
            },
        },
        authorName: { type: "string" },
        viewCount: { type: "integer", minimum: 0 },
        category: {
            anyOf: [
                {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "name", "slug", "description", "createdAt", "updatedAt"],
                    properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        slug: { type: "string" },
                        description: { anyOf: [{ type: "string" }, { type: "null" }] },
                        createdAt: dateTime,
                        updatedAt: dateTime,
                    },
                },
                { type: "null" },
            ],
        },
        tags: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "name", "slug", "createdAt", "updatedAt"],
                properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    slug: { type: "string" },
                    createdAt: dateTime,
                    updatedAt: dateTime,
                },
            },
        },
        uploads: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: [
                    "id",
                    "filename",
                    "originalName",
                    "mimeType",
                    "size",
                    "createdAt",
                    "thumbhash",
                    "url",
                ],
                properties: {
                    id: { type: "string" },
                    filename: { type: "string" },
                    originalName: { type: "string" },
                    mimeType: { type: "string" },
                    size: { type: "integer", minimum: 0 },
                    createdAt: dateTime,
                    thumbhash: { anyOf: [{ type: "string" }, { type: "null" }] },
                    url: { type: "string" },
                },
            },
        },
        reactions: {
            type: "object",
            additionalProperties: false,
            required: ["like", "favorite", "save"],
            properties: {
                like: { type: "integer", minimum: 0 },
                favorite: { type: "integer", minimum: 0 },
                save: { type: "integer", minimum: 0 },
            },
        },
    },
} as const;

export const postResponseSchema = {
    type: "object",
    additionalProperties: false,
    required: ["data", "endpoint"],
    properties: { data: postSchema, endpoint: { type: "string" } },
} as const;

export const postCollectionResponseSchema = {
    type: "object",
    additionalProperties: false,
    required: ["data", "pagination", "endpoint"],
    properties: {
        data: { type: "array", items: postSchema },
        pagination: {
            type: "object",
            additionalProperties: false,
            required: ["page", "limit", "total", "totalPages"],
            properties: {
                page: { type: "integer", minimum: 1 },
                limit: { type: "integer", minimum: 1, maximum: 100 },
                total: { type: "integer", minimum: 0 },
                totalPages: { type: "integer", minimum: 0 },
            },
        },
        endpoint: { type: "string" },
    },
} as const;
