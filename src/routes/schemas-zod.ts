import { createSchema } from "zod-openapi";
import { z } from "zod/v4";

const lifecycleProperties = {
    status: z.enum(["draft", "published"]),
    visibility: z.enum(["public", "unlisted", "private"]),
    scheduledAt: z.iso.datetime().nullable(),
    contentWarning: z.string().max(500).nullable(),
};

const originalPostProperties = {
    originalCreator: z.string().min(1).max(500).nullable(),
    originalCreatedAt: z.iso.datetime().nullable(),
};

export const postCreateInput = z.object({
    title: z.string().min(1).max(500).describe("Post title."),
    description: z.string().max(10000).optional(),
    caption: z.string().max(10000).optional(),
    sourceUrl: z.string().max(4096).optional(),
    ...originalPostProperties,
    allowDownload: z.boolean().optional(),
    ...lifecycleProperties,
    tags: z.array(z.string().min(1).max(100)).max(100).optional(),
    categoryId: z.string().min(1).nullable().optional(),
    uploadIds: z.array(z.string().min(1)).max(100).optional(),
}).meta({ id: "PostCreateInput" });

export const postUpdateInput = z.object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(10000).nullable().optional(),
    caption: z.string().max(10000).nullable().optional(),
    allowDownload: z.boolean().optional(),
    sourceUrl: z.string().max(4096).nullable().optional(),
    ...originalPostProperties,
    categoryId: z.string().min(1).nullable().optional(),
    ...lifecycleProperties,
    tags: z.array(z.string().min(1).max(100)).max(100).optional(),
}).meta({ id: "PostUpdateInput" });

export type PostCreateInput = z.infer<typeof postCreateInput>;
export type PostUpdateInput = z.infer<typeof postUpdateInput>;

const jsonSchema = (schema: typeof postCreateInput) => createSchema(schema).schema;

export const postCreateBodyJsonSchema = jsonSchema(postCreateInput);
export const postUpdateBodyJsonSchema = jsonSchema(postUpdateInput);
