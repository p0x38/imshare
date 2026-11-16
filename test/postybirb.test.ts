import { afterAll, expect, test } from "vitest";

const { prisma } = await import("../src/lib/auth.js");
const { generateApiToken } = await import("../src/lib/api-tokens.js");
const { buildApp } = await import("../src/app.js");

afterAll(async () => {
    await prisma.$disconnect();
});

type MultipartPart =
    | { name: string; value: string }
    | {
          name: string;
          filename: string;
          mimeType: string;
          data: Buffer;
      };

function makeMultipart(boundary: string, parts: MultipartPart[]): Buffer {
    const chunks: Buffer[] = [];

    for (const part of parts) {
        if ("filename" in part) {
            chunks.push(
                Buffer.from(
                    `--${boundary}\r\n` +
                        `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
                        `Content-Type: ${part.mimeType}\r\n\r\n`,
                ),
                part.data,
                Buffer.from("\r\n"),
            );
        } else {
            chunks.push(
                Buffer.from(
                    `--${boundary}\r\n` +
                        `Content-Disposition: form-data; name="${part.name}"\r\n\r\n` +
                        `${part.value}\r\n`,
                ),
            );
        }
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return Buffer.concat(chunks);
}

test("PostyBirb creates image and text posts", async () => {
    const app = await buildApp();
    const suffix = `postybirb-${Date.now().toString(36)}`;
    const userId = `${suffix}-user`;
    const firstTag = `${suffix}-first`;
    const secondTag = `${suffix}-second`;
    const generated = generateApiToken();
    const postsOnly = generateApiToken();

    try {
        await prisma.user.create({
            data: {
                id: userId,
                name: "PostyBirb Test",
                email: `${suffix}@example.test`,
            },
        });

        await prisma.apiToken.createMany({
            data: [
                {
                    name: "PostyBirb",
                    tokenPrefix: generated.prefix,
                    tokenHash: generated.hash,
                    permissionsJson: JSON.stringify({
                        posts: ["write"],
                        uploads: ["write", "delete"],
                    }),
                    userId,
                },
                {
                    name: "Posts only",
                    tokenPrefix: postsOnly.prefix,
                    tokenHash: postsOnly.hash,
                    permissionsJson: JSON.stringify({ posts: ["write"] }),
                    userId,
                },
            ],
        });

        const sharp = (await import("sharp")).default;
        const firstImage = await sharp({
            create: {
                width: 2,
                height: 2,
                channels: 3,
                background: { r: 220, g: 40, b: 40 },
            },
        })
            .png()
            .toBuffer();
        const secondImage = await sharp({
            create: {
                width: 2,
                height: 2,
                channels: 3,
                background: { r: 40, g: 100, b: 220 },
            },
        })
            .png()
            .toBuffer();

        const imageBoundary = `${suffix}-images`;
        const imagePayload = makeMultipart(imageBoundary, [
            { name: "title", value: "PostyBirb image batch" },
            {
                name: "description",
                value: "<div>First <strong>line</strong></div><div>Second line</div>",
            },
            { name: "tags", value: `${firstTag},${secondTag}` },
            { name: "rating", value: "MATURE" },
            {
                name: "file",
                filename: "first.png",
                mimeType: "image/png",
                data: firstImage,
            },
            {
                name: "file",
                filename: "second.png",
                mimeType: "image/png",
                data: secondImage,
            },
            { name: "altText[0]", value: "First image alt text" },
            { name: "sourceUrls[0]", value: "https://example.com/first" },
            { name: "sourceUrls[0]", value: "https://example.org/first" },
            { name: "altText[1]", value: "Second image alt text" },
            { name: "sourceUrls[1]", value: "https://example.com/second" },
        ]);

        const imageHeaders = {
            "content-type": `multipart/form-data; boundary=${imageBoundary}`,
        };

        const denied = await app.inject({
            method: "POST",
            url: "/api/v1/posts/postybirb",
            headers: {
                ...imageHeaders,
                authorization: `Bearer ${postsOnly.token}`,
            },
            payload: imagePayload,
        });
        expect(denied.statusCode).toBe(403);

        const imageResponse = await app.inject({
            method: "POST",
            url: "/api/v1/posts/postybirb",
            headers: {
                ...imageHeaders,
                authorization: `Bearer ${generated.token}`,
            },
            payload: imagePayload,
        });

        expect(imageResponse.statusCode).toBe(200);
        const imageData = imageResponse.json().data as {
            id: string;
            url: string;
            status: string;
            visibility: string;
            uploads: Array<{
                id: string;
                alt: string | null;
                sourceUrls: string[];
            }>;
        };

        expect(imageData).toMatchObject({
            id: expect.any(String),
            url: expect.any(String),
            status: "draft",
            visibility: "private",
        });
        expect(imageData.uploads).toHaveLength(2);
        expect(imageData.uploads[0]).toMatchObject({
            alt: "First image alt text",
            sourceUrls: ["https://example.com/first", "https://example.org/first"],
        });
        expect(imageData.uploads[1]).toMatchObject({
            alt: "Second image alt text",
            sourceUrls: ["https://example.com/second"],
        });

        const imagePost = await prisma.post.findUnique({
            where: { id: imageData.id },
            include: {
                uploads: true,
                tags: { include: { tag: true } },
            },
        });

        expect(imagePost).toMatchObject({
            title: "PostyBirb image batch",
            contentType: "image",
            description: "First line\nSecond line",
            status: "draft",
            visibility: "private",
            isNSFW: true,
        });
        expect(imagePost?.uploads).toHaveLength(2);
        expect(imagePost?.tags.map(({ tag }) => tag.slug).sort()).toEqual(
            [firstTag, secondTag].sort(),
        );

        const textBoundary = `${suffix}-text`;
        const textPayload = makeMultipart(textBoundary, [
            { name: "title", value: "PostyBirb text post" },
            {
                name: "description",
                value: "<div>Hello <strong>world</strong> &amp; welcome</div>",
            },
            { name: "tags", value: `${firstTag},${secondTag}` },
            { name: "rating", value: "GENERAL" },
        ]);

        const textResponse = await app.inject({
            method: "POST",
            url: "/api/v1/posts/notification",
            headers: {
                authorization: `Bearer ${generated.token}`,
                "content-type": `multipart/form-data; boundary=${textBoundary}`,
            },
            payload: textPayload,
        });

        expect(textResponse.statusCode).toBe(200);
        const textPost = await prisma.post.findUnique({
            where: { id: textResponse.json().data.id },
        });
        expect(textPost).toMatchObject({
            title: "PostyBirb text post",
            contentType: "text",
            textContent: "Hello world & welcome",
            status: "draft",
            visibility: "private",
            isNSFW: false,
            allowDownload: false,
        });

        const notificationDenied = await app.inject({
            method: "POST",
            url: "/api/v1/posts/notification",
            headers: {
                "content-type": `multipart/form-data; boundary=${textBoundary}`,
            },
            payload: textPayload,
        });
        expect(notificationDenied.statusCode).toBe(401);

        const emptyImageBoundary = `${suffix}-empty`;
        const emptyImageResponse = await app.inject({
            method: "POST",
            url: "/api/v1/posts/postybirb",
            headers: {
                authorization: `Bearer ${generated.token}`,
                "content-type": `multipart/form-data; boundary=${emptyImageBoundary}`,
            },
            payload: makeMultipart(emptyImageBoundary, [
                { name: "title", value: "Empty image post" },
            ]),
        });
        expect(emptyImageResponse.statusCode).toBe(400);
    } finally {
        const uploads = await prisma.upload.findMany({
            where: { userId },
            select: { id: true },
        });

        await prisma.post.deleteMany({ where: { userId } });

        for (const upload of uploads) {
            await app.inject({
                method: "DELETE",
                url: `/api/v1/uploads/${upload.id}`,
                headers: { authorization: `Bearer ${generated.token}` },
            });
        }

        await prisma.apiToken.deleteMany({ where: { userId } });
        await prisma.tag.deleteMany({
            where: { slug: { in: [firstTag, secondTag] } },
        });
        await prisma.user.deleteMany({ where: { id: userId } });
        await app.close();
    }
}, 30_000);
