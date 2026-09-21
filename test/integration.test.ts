import type { LightMyRequestOptions } from "fastify";
import { expect, test } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/auth.js";
import { getRegistrationToken } from "../src/lib/registration-token.js";

test("API integration: authentication, users, posts, tags, categories, and search", async () => {
    const app = await buildApp();
    const email = "integration@example.test";
    const secondEmail = "integration-second@example.test";
    let cookie = "";
    let secondCookie = "";
    let postId = "";
    let categoryId = "";

    const request = (options: LightMyRequestOptions) =>
        app.inject({
            ...options,
            headers: {
                host: "localhost:5454",
                ...(options.headers ?? {}),
            },
        });

    const extractCookie = (response: Awaited<ReturnType<typeof app.inject>>) => {
        const value = response.headers["set-cookie"];
        const cookies = Array.isArray(value) ? value : value ? [value] : [];
        return cookies.map((item) => item.split(";", 1)[0]).join("; ");
    };

    try {
        const anonymous = await request({ method: "GET", url: "/api/v1/me" });
        expect(anonymous.statusCode).toBe(401);

        const registrationToken = getRegistrationToken().token;
        const signup = await request({
            method: "POST",
            url: "/api/v1/auth/sign-up/email",
            payload: {
                name: "Integration User",
                email,
                password: "integration-password-123",
                registrationToken,
            },
        });
        expect([200, 201]).toContain(signup.statusCode);
        expect(signup.body).toBeDefined();
        cookie = extractCookie(signup);
        expect(cookie).not.toBe("");

        const me = await request({ method: "GET", url: "/api/v1/me", headers: { cookie } });
        expect(me.statusCode).toBe(200);
        expect(me.json().data.email).toBe(email);
        const userId = me.json().data.id as string;

        const session = await request({
            method: "GET",
            url: "/api/v1/auth/get-session",
            headers: { cookie },
        });
        expect(session.statusCode).toBe(200);

        const category = await request({
            method: "POST",
            url: "/api/v1/categories",
            headers: { cookie },
            payload: { name: "Integration Category", slug: "integration-category" },
        });
        expect(category.statusCode).toBe(201);
        categoryId = category.json().data.id;

        const tag = await request({
            method: "POST",
            url: "/api/v1/tags",
            headers: { cookie },
            payload: { name: "Integration Tag", slug: "integration-tag" },
        });
        expect(tag.statusCode).toBe(201);
        const tagId = tag.json().data.id as string;

        const post = await request({
            method: "POST",
            url: "/api/v1/posts",
            headers: { cookie },
            payload: {
                title: "Integration Post",
                description: "Integration description",
                content: "Integration content",
            },
        });
        expect(post.statusCode).toBe(201);
        postId = post.json().data.id as string;

        const postRead = await request({ method: "GET", url: `/api/v1/posts/${postId}` });
        expect(postRead.statusCode).toBe(200);

        const posts = await request({ method: "GET", url: "/api/v1/posts" });
        expect(posts.statusCode).toBe(200);

        const userPosts = await request({ method: "GET", url: `/api/v1/users/${userId}/posts` });
        expect(userPosts.statusCode).toBe(200);

        const tags = await request({ method: "GET", url: "/api/v1/tags" });
        expect(tags.statusCode).toBe(200);

        const attachTag = await request({
            method: "POST",
            url: `/api/v1/posts/${postId}/tags`,
            headers: { cookie },
            payload: { tagId },
        });
        expect(attachTag.statusCode).toBe(200);

        const attachCategory = await request({
            method: "PUT",
            url: `/api/v1/posts/${postId}/category`,
            headers: { cookie },
            payload: { categoryId },
        });
        expect(attachCategory.statusCode).toBe(200);

        const search = await request({
            method: "GET",
            url: "/api/v1/search?q=Integration&type=all",
        });
        expect(search.statusCode).toBe(200);
        expect(search.json().data.posts).toHaveLength(1);

        const tagPosts = await request({ method: "GET", url: `/api/v1/tags/${tagId}/posts` });
        expect(tagPosts.statusCode).toBe(200);
        expect(tagPosts.json().pagination.total).toBe(1);

        const categoryPosts = await request({
            method: "GET",
            url: `/api/v1/categories/${categoryId}/posts`,
        });
        expect(categoryPosts.statusCode).toBe(200);
        expect(categoryPosts.json().pagination.total).toBe(1);

        const update = await request({
            method: "PATCH",
            url: `/api/v1/posts/${postId}`,
            headers: { cookie },
            payload: { title: "Updated Integration Post" },
        });
        expect(update.statusCode).toBe(200);

        const updateUser = await request({
            method: "PATCH",
            url: `/api/v1/users/${userId}`,
            headers: { cookie },
            payload: { name: "Updated Integration User" },
        });
        expect(updateUser.statusCode).toBe(200);

        const batchEditPost = await request({
            method: "POST",
            url: "/api/v1/posts",
            headers: { cookie },
            payload: { title: "Batch Edit Post", content: "Batch edit content" },
        });
        expect(batchEditPost.statusCode).toBe(201);
        const batchEditPostId = batchEditPost.json().data.id as string;

        const batchUpdate = await request({
            method: "PATCH",
            url: "/api/v1/posts/batch",
            headers: { cookie },
            payload: {
                postIds: [postId, batchEditPostId],
                status: "published",
                visibility: "unlisted",
                allowDownload: false,
                contentWarning: "Integration warning",
                categoryId,
                tags: ["Integration Batch Tag"],
            },
        });
        expect(batchUpdate.statusCode).toBe(200);
        expect(batchUpdate.json().data).toMatchObject({
            updatedCount: 2,
            postIds: [postId, batchEditPostId],
        });

        for (const id of [postId, batchEditPostId]) {
            const batchEdited = await request({
                method: "GET",
                url: "/api/v1/posts/" + id,
                headers: { cookie },
            });
            expect(batchEdited.statusCode).toBe(200);
            expect(batchEdited.json().data).toMatchObject({
                status: "published",
                visibility: "unlisted",
                allowDownload: false,
                contentWarning: "Integration warning",
            });
        }
        const batchPost = await request({
            method: "POST",
            url: "/api/v1/posts",
            headers: { cookie },
            payload: { title: "Batch Delete Post", content: "Batch delete content" },
        });
        expect(batchPost.statusCode).toBe(201);
        const batchPostId = batchPost.json().data.id as string;

        const batchDelete = await request({
            method: "DELETE",
            url: "/api/v1/posts/batch",
            headers: { cookie },
            payload: { postIds: [batchEditPostId, batchPostId] },
        });
        expect(batchDelete.statusCode).toBe(200);
        expect(batchDelete.json().data.deletedCount).toBe(2);

        const deletedPost = await request({
            method: "GET",
            url: `/api/v1/posts/${batchPostId}`,
        });
        expect(deletedPost.statusCode).toBe(404);

        const signupSecond = await request({
            method: "POST",
            url: "/api/v1/auth/sign-up/email",
            payload: {
                name: "Integration User Two",
                email: secondEmail,
                password: "integration-password-456",
                registrationToken,
            },
        });
        expect([200, 201]).toContain(signupSecond.statusCode);
        expect(signupSecond.body).toBeDefined();
        secondCookie = extractCookie(signupSecond);
        expect(secondCookie).not.toBe("");

        const forbiddenUpdate = await request({
            method: "PATCH",
            url: `/api/v1/posts/${postId}`,
            headers: { cookie: secondCookie },
            payload: { title: "Forbidden" },
        });
        expect(forbiddenUpdate.statusCode).toBe(403);

        const forbiddenDelete = await request({
            method: "DELETE",
            url: `/api/v1/posts/${postId}`,
            headers: { cookie: secondCookie },
        });
        expect(forbiddenDelete.statusCode).toBe(403);

        const logout = await request({
            method: "POST",
            url: "/api/v1/auth/sign-out",
            headers: { cookie },
        });
        expect(logout.statusCode).toBe(200);

        const afterLogout = await request({
            method: "GET",
            url: "/api/v1/me",
            headers: { cookie },
        });
        expect(afterLogout.statusCode).toBe(401);
    } finally {
        await app.close();
        await prisma.$disconnect();
    }
}, 30_000);
