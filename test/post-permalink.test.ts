import { expect, test } from "vitest";
import { normalizePostTitle, permalinkBase, postPermalink } from "../src/lib/post-permalink.js";

const post = {
    id: "post-123",
    title: "Hello, World! #2",
    createdAt: new Date("2026-09-19T11:22:33.456Z"),
    customPostId: "custom value",
    permalinkPattern: "posts" as const,
    permalinkIdType: "normalizedTitle" as const,
    permalinkKey: null,
};

test("normalizePostTitle makes a stable URL-safe slug", () => {
    expect(normalizePostTitle("  Héllo,   World!  #2  ")).toBe("héllo-world-2");
    expect(normalizePostTitle("!!!")).toBe("post");
});

test("permalinkBase supports each configured identifier type", () => {
    expect(permalinkBase(post, "normalizedTitle")).toBe("hello-world-2");
    expect(permalinkBase(post, "internalId")).toBe("post-123");
    expect(permalinkBase(post, "creationDate")).toBe("20260919112233");
    expect(permalinkBase(post, "custom")).toBe("custom-value");
});

test("postPermalink uses an explicit permalink key for posts", () => {
    expect(
        postPermalink({
            ...post,
            permalinkKey: "my-key",
        }),
    ).toBe("/posts/my-key/");
});

test("postPermalink uses the internal ID for posts when requested", () => {
    expect(
        postPermalink({
            ...post,
            permalinkIdType: "internalId",
            permalinkKey: null,
        }),
    ).toBe("/posts/post-123/");
});

test("postPermalink builds user-scoped links from the handle", () => {
    expect(
        postPermalink(
            {
                ...post,
                permalinkPattern: "user",
                permalinkIdType: "normalizedTitle",
                permalinkKey: "hello world",
            },
            { handle: "p0x38", id: "user-1" },
        ),
    ).toBe("/p0x38/hello%20world/");
});

test("postPermalink falls back to the user ID and then a generic user", () => {
    const userScopedPost = {
        ...post,
        permalinkPattern: "user" as const,
        permalinkKey: "hello",
    };

    expect(postPermalink(userScopedPost, { handle: "", id: "user-1" })).toBe("/user-1/hello/");
    expect(postPermalink(userScopedPost, null)).toBe("/user/hello/");
});
