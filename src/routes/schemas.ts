export const userCreateSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "email"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100 },
      email: { type: "string", minLength: 3, maxLength: 320 },
      image: { type: "string", maxLength: 2048 },
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
      image: { anyOf: [{ type: "string", maxLength: 2048 }, { type: "null" }] },
    },
  },
} as const;

export const postCreateSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 500 },
      description: { type: "string", maxLength: 10000 },
      sourceUrl: { type: "string", maxLength: 4096 },
      tags: { type: "array", maxItems: 100, items: { type: "string", minLength: 1, maxLength: 100 } },
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
      description: { anyOf: [{ type: "string", maxLength: 10000 }, { type: "null" }] },
      sourceUrl: { anyOf: [{ type: "string", maxLength: 4096 }, { type: "null" }] },
      categoryId: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
      tags: { type: "array", maxItems: 100, items: { type: "string", minLength: 1, maxLength: 100 } },
    },
  },
} as const;

export const postTagSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["tagId"],
    properties: {
      tagId: { type: "string", minLength: 1 },
    },
  },
} as const;

export const postCategorySchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["categoryId"],
    properties: {
      categoryId: { type: "string", minLength: 1 },
    },
  },
} as const;

export const tagCreateSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "slug"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100 },
      slug: { type: "string", minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
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
      slug: { type: "string", minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
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
      slug: { type: "string", minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
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
      slug: { type: "string", minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
      description: { anyOf: [{ type: "string", maxLength: 10000 }, { type: "null" }] },
    },
  },
} as const;
