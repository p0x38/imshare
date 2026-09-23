import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { openapi, parameter } from "../lib/openapi-route.js";

const MODES = ["default", "initials", "identicon", "gravatar", "custom"] as const;
type AvatarMode = (typeof MODES)[number];
function normalizeAvatarMode(value: string | null | undefined): AvatarMode {
    const normalized = value?.trim().toLowerCase();
    return (MODES as readonly string[]).includes(normalized ?? "")
        ? (normalized as AvatarMode)
        : "initials";
}
function escapeXml(value: string): string {
    return value.replace(
        /[&<>\"']/g,
        (char) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ??
            char,
    );
}
function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 1) return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
    return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}
function avatarSvg(name: string, mode: AvatarMode): string {
    const text = initials(name);
    if (mode === "default")
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#888"/><circle cx="64" cy="48" r="24" fill="#eee"/><path d="M24 116c4-29 18-43 40-43s36 14 40 43" fill="#eee"/></svg>`;
    const hash = createHash("sha256").update(name).digest();
    const hue = (hash[0] ?? 0) * 1.41;
    const background = `hsl(${hue.toFixed(0)} 55% 45%)`;
    if (mode === "identicon") {
        const cells = Array.from({ length: 15 }, (_, index) => {
            const column = index % 5;
            const row = Math.floor(index / 5);
            const value = hash[index % hash.length] ?? 0;
            return value % 2 === 0
                ? `<rect x="${27 + column * 15}" y="${27 + row * 15}" width="15" height="15"/>`
                : "";
        }).join("");
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="${background}"/><g fill="#fff">${cells}</g></svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="${background}"/><text x="64" y="72" text-anchor="middle" font-family="sans-serif" font-size="42" font-weight="700" fill="#fff">${escapeXml(text)}</text></svg>`;
}

export const avatarRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get(
        "/v1/users/:userId/avatar",
        {
            schema: openapi({
                tags: "Users",
                summary: "Get a user's avatar",
                description:
                    "Returns the configured avatar as SVG or redirects to an external/custom avatar resource.",
                operationId: "getUserAvatar",
                parameters: [
                    parameter.path("userId", { type: "string" }, { description: "User ID." }),
                ],
                security: [{}],
                responses: {
                    "200": { description: "Avatar image." },
                    "302": { description: "Redirect to an external avatar image." },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            }),
        },
        async (request, reply) => {
            const { userId } = request.params as { userId: string };
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true, email: true, avatarMode: true, avatarValue: true },
            });
            if (!user)
                return reply
                    .code(404)
                    .send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
            const mode = normalizeAvatarMode(user.avatarMode);
            if (mode === "gravatar") {
                const hash = createHash("md5")
                    .update(user.email.trim().toLowerCase())
                    .digest("hex");
                return reply.redirect(`https://www.gravatar.com/avatar/${hash}?s=256&d=404`);
            }
            if (mode === "custom" && user.avatarValue?.trim()) {
                const value = user.avatarValue.trim();
                if (/^https?:\/\//i.test(value)) return reply.redirect(value);
                const upload = await prisma.upload.findUnique({
                    where: { id: value },
                    select: { userId: true },
                });
                if (upload?.userId === userId)
                    return reply.redirect(
                        `/api/v1/posts/image/${encodeURIComponent(value)}?width=256&height=256&fit=cover&format=webp`,
                    );
            }
            reply.header("content-type", "image/svg+xml; charset=utf-8");
            reply.header("cache-control", "public, max-age=86400");
            return reply.send(avatarSvg(user.name, mode));
        },
    );
};
