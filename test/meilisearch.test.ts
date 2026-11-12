import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("meilisearch");
    vi.resetModules();
});

test("falls back when the configured Meilisearch service is unavailable", async () => {
    vi.stubEnv("DATABASE_PROVIDER", "sqlite");
    vi.stubEnv("DATABASE_URL", "file:./meilisearch-test.db");
    vi.stubEnv("BETTER_AUTH_SECRET", "meilisearch-test-secret-with-enough-length");
    vi.stubEnv("MEILISEARCH_URL", "http://127.0.0.1:7700");
    vi.stubEnv("MEILISEARCH_API_KEY", "test-key");

    vi.doMock("meilisearch", () => ({
        Meilisearch: class {
            async getIndex() {
                throw new Error("Meilisearch is unavailable");
            }
        },
    }));

    vi.resetModules();

    const { searchMeilisearchPosts } = await import("../src/lib/meilisearch.js");

    await expect(searchMeilisearchPosts("test query")).resolves.toBeNull();
});
