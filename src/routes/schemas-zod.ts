import { createSchema } from "zod-openapi";
import { z } from "zod";

const lifecycleProperties = {
    status: z
        .enum(["draft", "published"])
        .meta({ description: "Publication state for the post.", example: "published" }),
    visibility: z
        .enum(["public", "unlisted", "private"])
        .meta({ description: "Controls who can discover the post.", example: "public" }),
    scheduledAt: z
        .iso.datetime()
        .nullable()
        .optional()
        .meta({
            description: "Optional time at which the post should become active.",
            example: "2026-09-15T12:00:00.000Z",
        }),
    contentWarning: z
        .string()
        .max(500)
        .nullable()
        .optional()
        .meta({ description: "Optional content warning shown with the post.", example: "Contains flashing imagery." }),
};

const originalPostProperties = {
    originalCreator: z
        .string()
        .min(1)
        .max(500)
        .nullable()
        .optional()
        .meta({ description: "Creator credited for the original content.", example: "Example Creator" }),
    originalCreatedAt: z
        .iso.datetime()
        .nullable()
        .optional()
        .meta({
            description: "Original creation time of the referenced content, when known.",
            example: "2026-08-20T18:30:00.000Z",
        }),
};

export const postCreateInput = z
    .object({
        title: z
            .string()
            .min(1)
            .max(500)
            .meta({ description: "Post title.", example: "A sample post" }),
        description: z
            .string()
            .max(10000)
            .optional()
            .meta({ description: "Optional long-form description for the post.", example: "This is an example description." }),
        caption: z
            .string()
            .max(10000)
            .optional()
            .meta({ description: "Optional caption displayed with the post.", example: "Hello from imshare!" }),
        sourceUrl: z
            .string()
            .max(4096)
            .optional()
            .meta({ description: "Optional URL pointing to the source of the content.", example: "https://example.com/source" }),
        ...originalPostProperties,
        allowDownload: z
            .boolean()
            .optional()
            .meta({ description: "Whether viewers may download attached files.", example: true }),
        ...lifecycleProperties,
        tags: z
            .array(z.string().min(1).max(100))
            .max(100)
            .optional()
            .meta({ description: "Tags associated with the post.", example: ["example", "image"] }),
        categoryId: z
            .string()
            .min(1)
            .nullable()
            .optional()
            .meta({ description: "Optional category identifier.", example: "category-id" }),
        uploadIds: z
            .array(z.string().min(1))
            .max(100)
            .optional()
            .meta({ description: "Identifiers of unused uploads to attach to the post.", example: ["upload-id-123"] }),
    })
    .meta({
        description: "Fields accepted when creating a post.",
        example: {
            title: "A sample post",
            description: "This is an example description.",
            caption: "Hello from imshare!",
            sourceUrl: "https://example.com/source",
            originalCreator: "Example Creator",
            originalCreatedAt: "2026-08-20T18:30:00.000Z",
            allowDownload: true,
            status: "published",
            visibility: "public",
            contentWarning: null,
            tags: ["example", "image"],
            categoryId: "category-id",
            uploadIds: ["upload-id-123"],
        },
    });

export const postUpdateInput = z
    .object({
        title: z
            .string()
            .min(1)
            .max(500)
            .optional()
            .meta({ description: "Replacement post title.", example: "An updated sample post" }),
        description: z
            .string()
            .max(10000)
            .nullable()
            .optional()
            .meta({ description: "Replacement description, or null to clear it.", example: "Updated description." }),
        caption: z
            .string()
            .max(10000)
            .nullable()
            .optional()
            .meta({ description: "Replacement caption, or null to clear it.", example: "Updated caption." }),
        allowDownload: z
            .boolean()
            .optional()
            .meta({ description: "Whether viewers may download attached files.", example: true }),
        sourceUrl: z
            .string()
            .max(4096)
            .nullable()
            .optional()
            .meta({ description: "Replacement source URL, or null to clear it.", example: "https://example.com/source" }),
        ...originalPostProperties,
        categoryId: z
            .string()
            .min(1)
            .nullable()
            .optional()
            .meta({ description: "Replacement category identifier, or null to remove the category.", example: "category-id" }),
        ...lifecycleProperties,
        tags: z
            .array(z.string().min(1).max(100))
            .max(100)
            .optional()
            .meta({ description: "Replacement set of tags.", example: ["updated", "example"] }),
    })
    .meta({
        description: "One or more post fields to update. At least one field is required.",
        example: {
            title: "An updated sample post",
            caption: "Updated caption.",
        },
    });

export type PostCreateInput = z.infer<typeof postCreateInput>;
export type PostUpdateInput = z.infer<typeof postUpdateInput>;

const jsonSchema = (
    schema: Parameters<typeof createSchema>[0],
): Record<string, unknown> => createSchema(schema).schema as Record<string, unknown>;

export const postCreateBodyJsonSchema = jsonSchema(postCreateInput);

export const postUpdateBodyJsonSchema = {
    ...jsonSchema(postUpdateInput),
    minProperties: 1,
};
