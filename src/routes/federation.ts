import type { FastifyPluginAsync } from "fastify";
import { loadConfig, resolveBaseUrl } from "../lib/config.js";
import { prisma } from "../lib/auth.js";
import { getSession } from "../lib/api.js";

const ACTIVITY_STREAMS = "https://www.w3.org/ns/activitystreams";
const SECURITY = "https://w3id.org/security/v1";
const WEBFINGER_ACTOR_REL = "self";
const ACTIVITY_JSON = "application/activity+json";
const JRD_JSON = "application/jrd+json";

function actorUrl(baseUrl: string, handle: string) {
    return `${baseUrl}/federation/actors/${encodeURIComponent(handle)}`;
}

function profileUrl(baseUrl: string, handle: string) {
    return `${baseUrl}/users/@${encodeURIComponent(handle)}`;
}

function postUrl(baseUrl: string, id: string) {
    return `${baseUrl}/posts/${encodeURIComponent(id)}/`;
}

function asActor(baseUrl: string, user: { id: string; name: string; handle: string; image: string | null }) {
    const actor = actorUrl(baseUrl, user.handle);
    return {
        "@context": [ACTIVITY_STREAMS, SECURITY],
        id: actor,
        type: "Person",
        preferredUsername: user.handle,
        name: user.name,
        url: profileUrl(baseUrl, user.handle),
        inbox: `${actor}/inbox`,
        outbox: `${actor}/outbox`,
        followers: `${actor}/followers`,
        following: `${actor}/following`,
        ...(user.image ? { icon: { type: "Image", mediaType: "image/*", url: user.image } } : {}),
        publicKey: {
            id: `${actor}#main-key`,
            owner: actor,
            publicKeyPem: "",
        },
    };
}

export const federationRoutes: FastifyPluginAsync = async (fastify) => {
    const config = await loadConfig();
    const baseUrl = resolveBaseUrl(config).replace(/\/$/, "");

    fastify.get("/.well-known/webfinger", async (request, reply) => {
        const query = request.query as { resource?: string; rel?: string | string[] };
        const resource = query.resource?.trim();
        if (!resource) {
            return reply.code(400).send({ error: { code: "WEBFINGER_RESOURCE_REQUIRED", message: "The resource query parameter is required." } });
        }

        let handle: string | null = null;
        if (resource.toLowerCase().startsWith("acct:")) {
            const account = resource.slice(5);
            const at = account.lastIndexOf("@");
            if (at > 0 && account.slice(at + 1).toLowerCase() === new URL(baseUrl).host.toLowerCase()) handle = account.slice(0, at);
        } else {
            try {
                const url = new URL(resource);
                if (url.origin === baseUrl) {
                    const match = url.pathname.match(/^\/users\/@([^/]+)\/?$/);
                    handle = match?.[1] ?? null;
                }
            } catch {
                return reply.code(400).send({ error: { code: "WEBFINGER_INVALID_RESOURCE", message: "The resource must be an acct URI or an absolute URI." } });
            }
        }

        if (!handle) return reply.code(404).send({ error: { code: "WEBFINGER_NOT_FOUND", message: "The requested resource was not found." } });
        const user = await prisma.user.findFirst({ where: { handle, isPublic: true, showProfile: true }, select: { handle: true } });
        if (!user?.handle) return reply.code(404).send({ error: { code: "WEBFINGER_NOT_FOUND", message: "The requested resource was not found." } });

        const actor = actorUrl(baseUrl, user.handle);
        const subject = `acct:${user.handle}@${new URL(baseUrl).host}`;
        const rels = Array.isArray(query.rel) ? query.rel : query.rel ? [query.rel] : [];
        const links = rels.length === 0 || rels.includes(WEBFINGER_ACTOR_REL) ? [{ rel: WEBFINGER_ACTOR_REL, type: ACTIVITY_JSON, href: actor }] : [];

        return reply
            .type(JRD_JSON)
            .header("Access-Control-Allow-Origin", "*")
            .send({ subject, aliases: [profileUrl(baseUrl, user.handle)], links });
    });

    fastify.get("/.well-known/nodeinfo", async (_request, reply) => {
        return reply
            .type(JRD_JSON)
            .header("Access-Control-Allow-Origin", "*")
            .send({
                links: [
                    {
                        rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
                        href: `${baseUrl}/nodeinfo/2.1`,
                    },
                ],
            });
    });

    fastify.get("/nodeinfo/2.1", async (_request, reply) => {
        const since = new Date();
        since.setMonth(since.getMonth() - 1);
        const [users, activeMonth, localPosts, localComments] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { updatedAt: { gte: since } } }),
            prisma.post.count({ where: { status: "published", visibility: "public" } }),
            prisma.comment.count(),
        ]);

        return reply.type("application/json").send({
            version: "2.1",
            software: {
                name: "imshare",
                version: config.site.version,
                repository: "https://github.com/p0x38/imshare",
            },
            protocols: ["activitypub"],
            services: { inbound: [], outbound: [] },
            usage: {
                users: { total: users, activeMonth },
                localPosts,
                localComments,
            },
            openRegistrations: config.auth.registration?.public === true,
            metadata: { siteName: config.site.name },
        });
    });

    fastify.get("/federation/actors/:handle", async (request, reply) => {
        const { handle } = request.params as { handle: string };
        const user = await prisma.user.findFirst({
            where: { handle, isPublic: true, showProfile: true },
            select: { id: true, name: true, handle: true, image: true },
        });
        if (!user?.handle) return reply.code(404).send({ error: { code: "ACTOR_NOT_FOUND", message: "The requested actor was not found." } });
        return reply.type(ACTIVITY_JSON).send(asActor(baseUrl, user));
    });

    fastify.post("/federation/actors/:handle/inbox", async (request, reply) => {
        const { handle } = request.params as { handle: string };
        const user = await prisma.user.findFirst({ where: { handle, isPublic: true, showProfile: true }, select: { id: true } });
        if (!user) return reply.code(404).send({ error: { code: "ACTOR_NOT_FOUND", message: "The requested actor was not found." } });

        const signature = request.headers.signature;
        if (!signature) {
            return reply.code(401).send({ error: { code: "FEDERATION_SIGNATURE_REQUIRED", message: "Federation requests require an HTTP Signature." } });
        }

        return reply.code(501).send({ error: { code: "FEDERATION_INBOX_NOT_IMPLEMENTED", message: "The federation inbox is reserved but request verification and delivery are not implemented yet." } });
    });

    fastify.get("/federation/actors/:handle/outbox", async (request, reply) => {
        const { handle } = request.params as { handle: string };
        const user = await prisma.user.findFirst({ where: { handle, isPublic: true, showProfile: true }, select: { id: true, name: true, handle: true, image: true } });
        if (!user?.handle) return reply.code(404).send({ error: { code: "ACTOR_NOT_FOUND", message: "The requested actor was not found." } });

        const posts = await prisma.post.findMany({
            where: { userId: user.id, status: "published", visibility: "public" },
            orderBy: { publishedAt: "desc" },
            take: 20,
            select: { id: true, title: true, description: true, createdAt: true, publishedAt: true },
        });
        const actor = actorUrl(baseUrl, user.handle);
        const items = posts.map((post) => ({
            id: `${postUrl(baseUrl, post.id)}#create`,
            type: "Create",
            actor,
            published: (post.publishedAt ?? post.createdAt).toISOString(),
            to: ["https://www.w3.org/ns/activitystreams#Public"],
            cc: [`${actor}/followers`],
            object: {
                id: postUrl(baseUrl, post.id),
                type: "Note",
                attributedTo: actor,
                content: post.description?.trim() || post.title,
                name: post.title,
                url: postUrl(baseUrl, post.id),
                published: (post.publishedAt ?? post.createdAt).toISOString(),
            },
        }));

        return reply.type(ACTIVITY_JSON).send({
            "@context": ACTIVITY_STREAMS,
            id: `${actor}/outbox`,
            type: "OrderedCollection",
            totalItems: items.length,
            orderedItems: items,
        });
    });
};
