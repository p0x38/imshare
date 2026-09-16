import { afterEach, expect, test, vi } from "vitest";
import { api, apiUrl } from "../src/client/lib/api.js";

afterEach(() => vi.restoreAllMocks());

test("apiUrl prefixes internal v1 API paths", () => {
    expect(apiUrl("/v1/posts")).toBe("/api/v1/posts");
    expect(apiUrl("/v1/posts?limit=20")).toBe("/api/v1/posts?limit=20");
});

test("apiUrl preserves non-v1 and absolute URLs", () => {
    expect(apiUrl("/account/login/")).toBe("/account/login/");
    expect(apiUrl("https://example.com/v1/posts")).toBe("https://example.com/v1/posts");
    expect(apiUrl("//cdn.example.com/file.png")).toBe("//cdn.example.com/file.png");
});

test("api normalizes API resource URLs recursively", async () => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
            new Response(
                JSON.stringify({
                    data: {
                        url: "/v1/posts/image/one",
                        avatarUrl: "/v1/users/avatar/one",
                        nested: [{ url: "/v1/posts/image/two" }],
                        unrelated: "/v1/not-a-url-field",
                    },
                }),
                { status: 200, headers: { "content-type": "application/json" } },
            ),
        ),
    );

    await expect(api("/v1/posts")).resolves.toEqual({
        data: {
            url: "/api/v1/posts/image/one",
            avatarUrl: "/api/v1/users/avatar/one",
            nested: [{ url: "/api/v1/posts/image/two" }],
            unrelated: "/v1/not-a-url-field",
        },
    });
});

test("api sends JSON headers for a request body", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.headers).toMatchObject({
            Accept: "application/json",
            "Content-Type": "application/json",
        });
        return new Response(JSON.stringify({ data: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
        });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api("/v1/posts", { method: "POST", body: JSON.stringify({ title: "test" }) })).resolves.toEqual({
        data: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("api preserves an explicit content type header", async () => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            expect(init?.headers).toMatchObject({ "Content-Type": "application/custom" });
            return new Response(JSON.stringify({ data: true }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        }),
    );

    await api("/v1/example", {
        headers: { "Content-Type": "application/custom" },
        body: "payload",
    });
});

test("api exposes structured server errors with status and payload", async () => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
            new Response(
                JSON.stringify({
                    error: { code: "POST_NOT_FOUND", message: "Post not found." },
                }),
                { status: 404, headers: { "content-type": "application/json" } },
            ),
        ),
    );

    const promise = api("/v1/posts/missing");
    await expect(promise).rejects.toThrow("Post not found.");
    try {
        await promise;
    } catch (error) {
        expect(error).toMatchObject({
            status: 404,
            data: { error: { code: "POST_NOT_FOUND" } },
        });
    }
});

test("api uses text responses when the server does not return JSON", async () => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("upstream failure", { status: 502, headers: { "content-type": "text/plain" } })),
    );

    await expect(api("/v1/example")).rejects.toThrow("upstream failure");
});
