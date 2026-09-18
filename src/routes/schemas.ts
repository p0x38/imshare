export const userCreateSchema = {
    body: {
        type: "object",
        additionalProperties: false,
        required: ["name", "email"],
        properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            handle: {
                type: ["string", "null"],
                minLength: 3,
                maxLength: 32,
                pattern: "^[a-z0-9_][a-z0-9_-]*$",
            },
            email: { type: "string", minLength: 3, maxLength: 320 },
            image: { type: "string", maxLength: 2048 },
            bio: { type: "string", maxLength: 2000 },
            websiteUrl: { type: "string", maxLength: 2048 },
            githubUrl: { type: "string", maxLength: 2048 },
        },
    },
} as const;
export const userUpdateSchema = {
    body: {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            handle: {
                anyOf: [
                    {
                        type: "string",
                        minLength: 3,
                        maxLength: 32,
                        pattern: "^[a-z0-9_][a-z0-9_-]*$",
                    },
                    { type: "null" },
                ],
            },
            image: { anyOf: [{ type: "string", maxLength: 2048 }, { type: "null" }] },
            bio: { anyOf: [{ type: "string", maxLength: 2000 }, { type: "null" }] },
            websiteUrl: { anyOf: [{ type: "string", maxLength: 2048 }, { type: "null" }] },
            githubUrl: { anyOf: [{ type: "string", maxLength: 2048 }, { type: "null" }] },
            avatarMode: {
                type: "string",
                enum: ["default", "initials", "identicon", "gravatar", "custom"],
            },
            avatarValue: { anyOf: [{ type: "string", maxLength: 2048 }, { type: "null" }] },
            profileBannerUrl: { anyOf: [{ type: "string", maxLength: 2048 }, { type: "null" }] },
            accentColor: {
                anyOf: [{ type: "string", pattern: "^#[0-9a-fA-F]{6}$" }, { type: "null" }],
            },
            isPublic: { type: "boolean" },
            showEmail: { type: "boolean" },
            showPosts: { type: "boolean" },
            showProfile: { type: "boolean" },
            showHandle: { type: "boolean" },
            showFollowers: { type: "boolean" },
            showFollowings: { type: "boolean" },
            allowSearchEngineIndex: { type: "boolean" },
            defaultCategoryId: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
            defaultPostVisibility: { type: "string", enum: ["public", "unlisted", "private"] },
            defaultAllowDownload: { type: "boolean" },
            defaultContentWarning: {
                anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }],
            },
        },
    },
} as const;
const postLifecycleProperties = {
    status: { type: "string", enum: ["draft", "published"] },
    visibility: { type: "string", enum: ["public", "unlisted", "private"] },
    scheduledAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
    contentWarning: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] },
};
const permalinkProperties = {
    permalinkPattern: { type: "string", enum: ["user", "posts"] },
    permalinkIdType: {
        type: "string",
        enum: ["normalizedTitle", "internalId", "creationDate", "custom"],
    },
    customPostId: { anyOf: [{ type: "string", minLength: 1, maxLength: 200 }, { type: "null" }] },
};
const originalPostProperties = {
    originalCreator: {
        anyOf: [{ type: "string", minLength: 1, maxLength: 500 }, { type: "null" }],
    },
    originalCreatedAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
};
const contentProperties = {
    contentType: { type: "string", enum: ["image", "text"] },
    textContent: { type: "string", minLength: 1, maxLength: 100000 },
};
export const postCreateSchema = {
    body: {
        type: "object",
        additionalProperties: false,
        required: ["title"],
        properties: {
            title: { type: "string", minLength: 1, maxLength: 500 },
            ...contentProperties,
            description: { type: "string", maxLength: 10000 },
            caption: { type: "string", maxLength: 10000 },
            sourceUrl: { type: "string", maxLength: 4096 },
            ...originalPostProperties,
            ...permalinkProperties,
            allowDownload: { type: "boolean" },
            ...postLifecycleProperties,
            tags: {
                type: "array",
                maxItems: 100,
                items: { type: "string", minLength: 1, maxLength: 100 },
            },
            categoryId: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
            uploadIds: { type: "array", maxItems: 100, items: { type: "string", minLength: 1 } },
        },
    },
} as const;
export const postUpdateSchema = {
    body: {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: {
            title: { type: "string", minLength: 1, maxLength: 500 },
            ...contentProperties,
            description: { anyOf: [{ type: "string", maxLength: 10000 }, { type: "null" }] },
            caption: { anyOf: [{ type: "string", maxLength: 10000 }, { type: "null" }] },
            allowDownload: { type: "boolean" },
            sourceUrl: { anyOf: [{ type: "string", maxLength: 4096 }, { type: "null" }] },
            ...originalPostProperties,
            ...permalinkProperties,
            categoryId: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
            ...postLifecycleProperties,
            tags: {
                type: "array",
                maxItems: 100,
                items: { type: "string", minLength: 1, maxLength: 100 },
            },
        },
    },
} as const;
export const postTagSchema = {
    body: {
        type: "object",
        additionalProperties: false,
        required: ["tagId"],
        properties: { tagId: { type: "string", minLength: 1 } },
    },
} as const;
export const postCategorySchema = {
    body: {
        type: "object",
        additionalProperties: false,
        required: ["categoryId"],
        properties: { categoryId: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] } },
    },
} as const;
export const tagCreateSchema = {
    body: {
        type: "object",
        additionalProperties: false,
        required: ["name", "slug"],
        properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            slug: {
                type: "string",
                minLength: 1,
                maxLength: 100,
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            },
        },
    },
} as const;
export const tagUpdateSchema = {
    body: {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            slug: {
                type: "string",
                minLength: 1,
                maxLength: 100,
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            },
        },
    },
} as const;
export const categoryCreateSchema = {
    body: {
        type: "object",
        additionalProperties: false,
        required: ["name", "slug"],
        properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            slug: {
                type: "string",
                minLength: 1,
                maxLength: 100,
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            },
            description: { type: "string", maxLength: 10000 },
        },
    },
} as const;
export const categoryUpdateSchema = {
    body: {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            slug: {
                type: "string",
                minLength: 1,
                maxLength: 100,
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            },
        },
    },
} as const;
