import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { loadConfig, resolveBaseUrl } from "../lib/config.js";
import { prisma } from "../lib/auth.js";
import {
    addFollower,
    deliverActivity,
    getOrCreateActorKey,
    removeFollower,
    storeIncomingActivity,
    verifyFederationRequest,
} from "../lib/federation.js";

const ACTIVITY_STREAMS = "https://www.w3.org/ns/activitystreams";
const SECURITY = "https://w3id.org/security/v1";
const WEBFINGER_ACTOR_REL = "self";
const ACTIVITY_JSON = "application/activity+json";
const JRD_JSON = "application/jrd+json";
const PUBLIC = "https://www.w3.org/ns/activitystreams#Public";

function actorUrl(baseUrl: string, handle: string) {
    return `${baseUrl}/federation/actors/${encodeURIComponent(handle)}`;
}
function profileUrl(baseUrl: string, handle: string) {
    return `${baseUrl}/users/@${encodeURIComponent(handle)}`;
}
function postUrl(baseUrl: string, id: string) {
    return `${baseUrl}/posts/${encodeURIComponent(id)}/`;
}
function activityId(baseUrl: string, id: string) {
    return `${postUrl(baseUrl, id)}#create`;
}
function isPubliclyAddressed(activity: Record<string, unknown>) {
    const values = [...toStringArray(activity.to), ...toStringArray(activity.cc)];
    return values.includes(PUBLIC);
}
function toStringArray(value: unknown): string[] {
    if (typeof value === "string") return [value];
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
}
function firstString(...values: unknown[]): string | undefined {
    return values.find((value): value is string => typeof value === "string" && value.length > 0);
}
function asActor(
    baseUrl: string,
    user: { id: string; name: string; handle: string; image: string | null },
    publicKeyPem: string,
) {
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
        publicKey: { id: `${actor}#main-key`, owner: actor, publicKeyPem },
    };
}
function postActivity(
    baseUrl: string,
    actor: string,
    post: {
        id: string;
        title: string;
        description: string | null;
        createdAt: Date;
        publishedAt: Date | null;
    },
) {
    const published = (post.publishedAt ?? post.createdAt).toISOString();
    return {
        "@context": ACTIVITY_STREAMS,
        id: activityId(baseUrl, post.id),
        type: "Create",
        actor,
        published,
        to: [PUBLIC],
        cc: [`${actor}/followers`],
        object: {
            id: postUrl(baseUrl, post.id),
            type: "Note",
            attributedTo: actor,
            content: post.description?.trim() || post.title,
            name: post.title,
            url: postUrl(baseUrl, post.id),
            published,
        },
    };
}
async function localActor(baseUrl: string, handle: string) {
    const user = await prisma.user.findFirst({
        where: { handle },
        select: { id: true, name: true, handle: true, image: true },
    });
    const resolvedHandle = user?.handle;
    if (!resolvedHandle) return null;
    const normalizedUser = { ...user, handle: resolvedHandle };
    const actor = actorUrl(baseUrl, resolvedHandle);
    const key = await getOrCreateActorKey(user.id, actor);
    return { user: normalizedUser, actor, key };
}

async function handleActivity(
    baseUrl: string,
    activity: Record<string, unknown>,
    recipientUserId: string,
) {
    const type = activity.type;
    const actor = firstString(activity.actor);
    if (!actor || actor === "[object Object]") throw new Error("Activity actor is required.");

    if (type === "Follow") {
        const followerInbox =
            typeof activity.actor === "object" && activity.actor !== null
                ? firstString((activity.actor as Record<string, unknown>).inbox)
                : undefined;
        const actorData = (await (
            await fetch(actor, {
                headers: { accept: "application/activity+json, application/ld+json" },
                redirect: "error",
                signal: AbortSignal.timeout(10_000),
            })
        ).json()) as { inbox?: string; endpoints?: { sharedInbox?: string } };
        const inbox = followerInbox ?? actorData.inbox;
        if (!inbox) throw new Error("Follower actor has no inbox.");
        await addFollower(recipientUserId, {
            actorId: actor,
            inbox,
            sharedInbox: actorData.endpoints?.sharedInbox,
        });
        return;
    }
    if (type === "Undo") {
        const object = activity.object;
        if (
            typeof object === "object" &&
            object !== null &&
            (object as Record<string, unknown>).type === "Follow"
        )
            await removeFollower(recipientUserId, actor);
        return;
    }
    if (type === "Accept" || type === "Reject") return;
    if (type === "Create" && isPubliclyAddressed(activity)) return;
    if (type === "Delete") return;
    throw new Error(`Unsupported federation activity type: ${String(type)}`);
}

export const federationRoutes: FastifyPluginAsync = async (fastify) => {
    const config = await loadConfig();
    const baseUrl = resolveBaseUrl(config).replace(/\/$/, "");

    fastify.get("/.well-known/webfinger", async (request, reply) => {
        const query = request.query as { resource?: string; rel?: string | string[] };
        const resource = query.resource?.trim();
        if (!resource)
            return reply.code(400).send({
                error: {
                    code: "WEBFINGER_RESOURCE_REQUIRED",
                    message: "The resource query parameter is required.",
                },
            });
        let handle: string | null = null;
        if (resource.toLowerCase().startsWith("acct:")) {
            const account = resource.slice(5);
            const at = account.lastIndexOf("@");
            if (
                at > 0 &&
                account.slice(at + 1).toLowerCase() === new URL(baseUrl).host.toLowerCase()
            )
                handle = account.slice(0, at);
        } else {
            try {
                const url = new URL(resource);
                if (url.origin === baseUrl)
                    handle = url.pathname.match(/^\/users\/@([^/]+)\/?$/)?.[1] ?? null;
            } catch {
                return reply.code(400).send({
                    error: {
                        code: "WEBFINGER_INVALID_RESOURCE",
                        message: "The resource must be an acct URI or an absolute URI.",
                    },
                });
            }
        }
        if (!handle)
            return reply.code(404).send({
                error: {
                    code: "WEBFINGER_NOT_FOUND",
                    message: "The requested resource was not found.",
                },
            });
        const user = await prisma.user.findFirst({
            where: { handle, isPublic: true, showProfile: true },
            select: { handle: true },
        });
        if (!user?.handle)
            return reply.code(404).send({
                error: {
                    code: "WEBFINGER_NOT_FOUND",
                    message: "The requested resource was not found.",
                },
            });
        const actor = actorUrl(baseUrl, user.handle);
        const subject = `acct:${user.handle}@${new URL(baseUrl).host}`;
        const rels = Array.isArray(query.rel) ? query.rel : query.rel ? [query.rel] : [];
        const links =
            rels.length === 0 || rels.includes(WEBFINGER_ACTOR_REL)
                ? [{ rel: WEBFINGER_ACTOR_REL, type: ACTIVITY_JSON, href: actor }]
                : [];
        return reply
            .type(JRD_JSON)
            .header("Access-Control-Allow-Origin", "*")
            .send({ subject, aliases: [profileUrl(baseUrl, user.handle)], links });
    });

    fastify.get("/.well-known/nodeinfo", async (_request, reply) =>
        reply
            .type(JRD_JSON)
            .header("Access-Control-Allow-Origin", "*")
            .send({
                links: [
                    {
                        rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
                        href: `${baseUrl}/nodeinfo/2.1`,
                    },
                ],
            }),
    );

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
            services: { inbound: ["atom"], outbound: ["atom"] },
            usage: { users: { total: users, activeMonth }, localPosts, localComments },
            openRegistrations: config.auth.registration?.public === true,
            metadata: { siteName: config.site.name },
        });
    });

    fastify.get("/federation/actors/:handle", async (request, reply) => {
        const { handle } = request.params as { handle: string };
        const local = await localActor(baseUrl, handle);
        if (!local)
            return reply.code(404).send({
                error: {
                    code: "ACTOR_NOT_FOUND",
                    message: "The requested actor was not found.",
                },
            });
        return reply.type(ACTIVITY_JSON).send(asActor(baseUrl, local.user, local.key.publicKeyPem));
    });

    fastify.get("/federation/actors/:handle/outbox", async (request, reply) => {
        const { handle } = request.params as { handle: string };
        const local = await localActor(baseUrl, handle);
        if (!local)
            return reply.code(404).send({
                error: {
                    code: "ACTOR_NOT_FOUND",
                    message: "The requested actor was not found.",
                },
            });
        const posts = await prisma.post.findMany({
            where: { userId: local.user.id, status: "published", visibility: "public" },
            orderBy: { publishedAt: "desc" },
            take: 20,
            select: {
                id: true,
                title: true,
                description: true,
                createdAt: true,
                publishedAt: true,
            },
        });
        const items = posts.map((post) => postActivity(baseUrl, local.actor, post));
        return reply.type(ACTIVITY_JSON).send({
            "@context": ACTIVITY_STREAMS,
            id: `${local.actor}/outbox`,
            type: "OrderedCollection",
            totalItems: items.length,
            orderedItems: items,
        });
    });

    fastify.post("/federation/actors/:handle/inbox", async (request, reply) => {
        const { handle } = request.params as { handle: string };
        const local = await localActor(baseUrl, handle);
        if (!local)
            return reply.code(404).send({
                error: {
                    code: "ACTOR_NOT_FOUND",
                    message: "The requested actor was not found.",
                },
            });

        const rawBody =
            typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {});
        try {
            const requestHeaders: [string, string][] = Object.entries(request.headers).flatMap(
                ([name, value]) => (typeof value === "string" ? [[name, value]] : []),
            );
            const webRequest = new Request(
                `${baseUrl}${request.raw.url ?? `/federation/actors/${encodeURIComponent(handle)}/inbox`}`,
                {
                    method: request.method,
                    headers: requestHeaders,
                    body: rawBody,
                },
            );
            const verified = await verifyFederationRequest(webRequest, rawBody);
            const activity = JSON.parse(rawBody) as Record<string, unknown>;
            await handleActivity(baseUrl, activity, local.user.id);
            await storeIncomingActivity(activity);
            if (activity.type === "Follow" && typeof activity.actor === "string") {
                const accept = {
                    "@context": ACTIVITY_STREAMS,
                    id: `${local.actor}#accept-${Date.now()}`,
                    type: "Accept",
                    actor: local.actor,
                    object: activity,
                };
                const followerResponse = (await (
                    await fetch(verified.actor.id ?? verified.keyId, {
                        headers: { accept: "application/activity+json" },
                        redirect: "error",
                        signal: AbortSignal.timeout(10_000),
                    })
                ).json()) as { inbox?: string };
                if (followerResponse.inbox)
                    await deliverActivity({
                        inbox: followerResponse.inbox,
                        actorUrl: local.actor,
                        activity: accept,
                        privateKeyPem: local.key.privateKeyPem,
                    });
            }
            return reply.code(202).send({ data: { accepted: true } });
        } catch (error) {
            request.log.warn({ err: error }, "Rejected federation activity");
            return reply.code(401).send({
                error: {
                    code: "FEDERATION_REQUEST_REJECTED",
                    message:
                        error instanceof Error ? error.message : "Federation request rejected.",
                },
            });
        }
    });

    fastify.post("/federation/deliver", async (request, reply) => {
        const session = await import("../lib/api.js").then(({ getSession }) =>
            getSession(request as FastifyRequest),
        );
        if (!session)
            return reply
                .code(401)
                .send({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
        const body = request.body as { handle?: string; inbox?: string; activity?: unknown };
        if (!body?.handle || !body.inbox || body.activity === undefined)
            return reply.code(400).send({
                error: {
                    code: "INVALID_DELIVERY",
                    message: "handle, inbox and activity are required.",
                },
            });
        const local = await localActor(baseUrl, body.handle);
        if (!local || local.user.id !== session.user.id)
            return reply.code(403).send({
                error: { code: "FORBIDDEN", message: "You may only deliver as yourself." },
            });
        const result = await deliverActivity({
            inbox: body.inbox,
            actorUrl: local.actor,
            activity: body.activity,
            privateKeyPem: local.key.privateKeyPem,
        });
        return result.ok
            ? { data: result }
            : reply.code(502).send({
                  error: {
                      code: "FEDERATION_DELIVERY_FAILED",
                      message: `Remote server returned HTTP ${result.status}.`,
                  },
                  data: result,
              });
    });
};
