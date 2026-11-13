import { Meilisearch } from "meilisearch";
import { env } from "./env.js";
import { prisma } from "./database.js";

interface SearchDocument {
    id: string;
    userId: string;
    title: string;
    description: string;
    caption: string;
    textContent: string;
}

const searchableAttributes = ["title", "description", "caption", "textContent"];
const filterableAttributes = ["userId"];
const readinessDocumentId = "__imshare_index_ready__";
let client: Meilisearch | null | undefined;
let indexPromise: ReturnType<typeof initializeIndex> | undefined;
let indexNeedsRebuild = false;

function getClient(): Meilisearch | null {
    if (client !== undefined) return client;
    const { url, apiKey } = env.meilisearch;
    if (!url && !apiKey) {
        client = null;
        return null;
    }
    if (!url || !apiKey)
        throw new Error("MEILISEARCH_URL and MEILISEARCH_API_KEY must both be set.");
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:")
        throw new Error("MEILISEARCH_URL must use HTTP or HTTPS.");
    client = new Meilisearch({
        host: parsedUrl.toString().replace(/\/$/, ""),
        apiKey,
        timeout: 5_000,
    });
    return client;
}

async function initializeIndex(searchClient: Meilisearch) {
    const indexUid = env.meilisearch.indexUid;
    const index = await searchClient.getIndex<SearchDocument>(indexUid);
    const settingsTask = await index.updateSettings({ searchableAttributes, filterableAttributes });
    await searchClient.tasks.waitForTask(settingsTask.taskUid);
    try {
        await index.getDocument(readinessDocumentId);
        indexNeedsRebuild = false;
    } catch {
        indexNeedsRebuild = true;
    }
    return index;
}

async function getIndex() {
    const searchClient = getClient();
    if (!searchClient) return null;
    if (!indexPromise) {
        indexPromise = initializeIndex(searchClient).catch((error: unknown) => {
            indexPromise = undefined;
            throw error;
        });
    }
    return indexPromise;
}

function publicPostWhere(now: Date) {
    return {
        status: "published",
        visibility: "public",
        hiddenAt: null,
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
        user: { isPublic: true, showPosts: true, showProfile: true, isBanned: false },
    };
}

function toSearchDocument(post: {
    id: string;
    userId: string;
    title: string;
    description: string | null;
    caption: string | null;
    textContent: string | null;
}): SearchDocument {
    return {
        id: post.id,
        userId: post.userId,
        title: post.title,
        description: post.description ?? "",
        caption: post.caption ?? "",
        textContent: post.textContent ?? "",
    };
}

export async function searchMeilisearchPosts(term: string): Promise<string[] | null> {
    try {
        const index = await getIndex();
        if (!index || indexNeedsRebuild) return null;
        const response = await index.search<SearchDocument>(term, { limit: 1000 });
        return response.hits.map(({ id }) => id);
    } catch (error) {
        console.error("[search] Meilisearch query failed; falling back to SQLite FTS5:", error);
        return null;
    }
}

export async function syncMeilisearchPosts(postIds: string[]): Promise<void> {
    const ids = [...new Set(postIds.filter(Boolean))];
    if (!ids.length) return;
    try {
        const index = await getIndex();
        if (!index || indexNeedsRebuild) return;
        const posts = await prisma.post.findMany({
            where: { id: { in: ids }, ...publicPostWhere(new Date()) },
            select: {
                id: true,
                userId: true,
                title: true,
                description: true,
                caption: true,
                textContent: true,
            },
        });
        const indexedIds = new Set(posts.map(({ id }) => id));
        const removedIds = ids.filter((id) => !indexedIds.has(id));
        const taskUids: number[] = [];
        if (posts.length) {
            const task = await index.addDocuments(posts.map(toSearchDocument));
            taskUids.push(task.taskUid);
        }
        if (removedIds.length) {
            const task = await index.deleteDocuments(removedIds);
            taskUids.push(task.taskUid);
        }
        await Promise.all(taskUids.map((taskUid) => getClient()!.tasks.waitForTask(taskUid)));
    } catch (error) {
        console.error("[search] Meilisearch post sync failed:", error);
    }
}

export async function syncMeilisearchUserPosts(userId: string): Promise<void> {
    try {
        const posts = await prisma.post.findMany({ where: { userId }, select: { id: true } });
        await syncMeilisearchPosts(posts.map(({ id }) => id));
    } catch (error) {
        console.error("[search] Meilisearch user post sync failed:", error);
    }
}

export async function removeMeilisearchUserPosts(userId: string): Promise<void> {
    try {
        const index = await getIndex();
        const searchClient = getClient();
        if (!index || !searchClient || indexNeedsRebuild) return;
        const task = await index.deleteDocuments({ filter: `userId = ${JSON.stringify(userId)}` });
        await searchClient.tasks.waitForTask(task.taskUid);
    } catch (error) {
        console.error("[search] Meilisearch user cleanup failed:", error);
    }
}

export async function rebuildMeilisearchIndex(): Promise<void> {
    const searchClient = getClient();
    if (!searchClient)
        throw new Error("Set MEILISEARCH_URL and MEILISEARCH_API_KEY before rebuilding the index.");
    let index = await getIndex().catch(async () => {
        const task = await searchClient.createIndex(env.meilisearch.indexUid, { primaryKey: "id" });
        await searchClient.tasks.waitForTask(task.taskUid);
        indexPromise = undefined;
        return getIndex();
    });
    if (!index) throw new Error("Meilisearch index is unavailable.");
    indexNeedsRebuild = true;
    const clearTask = await index.deleteAllDocuments();
    await searchClient.tasks.waitForTask(clearTask.taskUid);

    let skip = 0;
    const batchSize = 500;
    while (true) {
        const posts = await prisma.post.findMany({
            where: publicPostWhere(new Date()),
            orderBy: { id: "asc" },
            skip,
            take: batchSize,
            select: {
                id: true,
                userId: true,
                title: true,
                description: true,
                caption: true,
                textContent: true,
            },
        });
        if (!posts.length) break;
        const task = await index.addDocuments(posts.map(toSearchDocument));
        await searchClient.tasks.waitForTask(task.taskUid);
        skip += posts.length;
    }
    const readyTask = await index.addDocuments([
        {
            id: readinessDocumentId,
            userId: "",
            title: "",
            description: "",
            caption: "",
            textContent: "",
        },
    ]);
    await searchClient.tasks.waitForTask(readyTask.taskUid);
    indexNeedsRebuild = false;
}
