import { createSchema } from "zod-openapi";
import { z } from "zod";

const lifecycleProperties = {
    status: z
        .enum(["draft", "published"])
        .optional()
        .meta({ description: "Publication state for the post." }),
    visibility: z
        .enum(["public", "unlisted", "private"])
        .optional()
        .meta({ description: "Controls who can discover the post." }),
    scheduledAt: z.iso
        .datetime()
        .nullable()
        .optional()
        .meta({ description: "Optional time at which the post should become active." }),
    contentWarning: z
        .string()
        .max(500)
        .nullable()
        .optional()
        .meta({ description: "Optional content warning shown with the post." }),
};

const originalPostProperties = {
    originalCreator: z
        .string()
        .min(1)
        .max(500)
        .nullable()
        .optional()
        .meta({ description: "Creator credited for the original content." }),
    originalCreatedAt: z.iso
        .datetime()
        .nullable()
        .optional()
        .meta({ description: "Original creation time of the referenced content, when known." }),
};

export const postCreateInput = z
    .object({
        title: z.string().min(1).max(500).meta({ description: "Post title." }),
        description: z
            .string()
            .max(10000)
            .optional()
            .meta({ description: "Optional long-form description for the post." }),
        caption: z
            .string()
            .max(10000)
            .optional()
            .meta({ description: "Optional caption displayed with the post." }),
        sourceUrl: z
            .string()
            .max(4096)
            .optional()
            .meta({ description: "Optional URL pointing to the source of the content." }),
        ...originalPostProperties,
        allowDownload: z
            .boolean()
            .optional()
            .meta({ description: "Whether viewers may download attached files." }),
        ...lifecycleProperties,
        tags: z
            .array(z.string().min(1).max(100))
            .max(100)
            .optional()
            .meta({ description: "Tags associated with the post." }),
        categoryId: z
            .string()
            .min(1)
            .nullable()
            .optional()
            .meta({ description: "Optional category identifier." }),
        uploadIds: z
            .array(z.string().min(1))
            .max(100)
            .optional()
            .meta({ description: "Identifiers of unused uploads to attach to the post." }),
    })
    .meta({ description: "Fields accepted when creating a post." });

export const postUpdateInput = z
    .object({
        title: z
            .string()
            .min(1)
            .max(500)
            .optional()
            .meta({ description: "Replacement post title." }),
        description: z
            .string()
            .max(10000)
            .nullable()
            .optional()
            .meta({ description: "Replacement description, or null to clear it." }),
        caption: z
            .string()
            .max(10000)
            .nullable()
            .optional()
            .meta({ description: "Replacement caption, or null to clear it." }),
        allowDownload: z
            .boolean()
            .optional()
            .meta({ description: "Whether viewers may download attached files." }),
        sourceUrl: z
            .string()
            .max(4096)
            .nullable()
            .optional()
            .meta({ description: "Replacement source URL, or null to clear it." }),
        ...originalPostProperties,
        categoryId: z
            .string()
            .min(1)
            .nullable()
            .optional()
            .meta({
                description: "Replacement category identifier, or null to remove the category.",
            }),
        ...lifecycleProperties,
        tags: z
            .array(z.string().min(1).max(100))
            .max(100)
            .optional()
            .meta({ description: "Replacement set of tags." }),
    })
    .meta({ description: "One or more post fields to update. At least one field is required." });

export type PostCreateInput = z.infer<typeof postCreateInput>;
export type PostUpdateInput = z.infer<typeof postUpdateInput>;

const jsonSchema = (schema: Parameters<typeof createSchema>[0]): Record<string, unknown> =>
    createSchema(schema).schema as Record<string, unknown>;

export const postCreateBodyJsonSchema = jsonSchema(postCreateInput);

export const postUpdateBodyJsonSchema = {
    ...jsonSchema(postUpdateInput),
    minProperties: 1,
};
