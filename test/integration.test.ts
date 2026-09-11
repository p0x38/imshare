import assert from "node:assert/strict";
import test from "node:test";
import type { LightMyRequestOptions } from "fastify";

import { buildApp } from "../src/app.js";
import { getRegistrationToken } from "../src/lib/registration-token.js";
import { prisma } from "../src/lib/auth.js";

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
                origin: "http://localhost:5454",
                ...(options.headers ?? {}),
            },
        });

    const extractCookie = (response: Awaited<ReturnType<typeof app.inject>>) => {
        const value = response.headers["set-cookie"];
        const cookies = Array.isArray(value) ? value : value ? [value] : [];
        return cookies.map((item) => item.split(";", 1)[0]).join("; ");
    };

    try {
        const anonymous = await request({ method: "GET", url: "/v1/me" });
        assert.equal(anonymous.statusCode, 401);

        const registrationToken = getRegistrationToken().token;
        const signup = await request({
            method: "POST",
            url: "/v1/auth/sign-up/email",
            payload: {
                name: "Integration User",
                email,
                password: "integration-password-123",
                registrationToken,
            },
        });
        assert.ok([200, 201].includes(signup.statusCode), signup.body);
        cookie = extractCookie(signup);
        assert.notEqual(cookie, "");

        const me = await request({ method: "GET", url: "/v1/me", headers: { cookie } });
        assert.equal(me.statusCode, 200);
        assert.equal(me.json().data.email, email);
        const userId = me.json().data.id as string;

        const session = await request({ method: "GET", url: "/v1/auth/get-session", headers: { cookie } });
        assert.equal(session.statusCode, 200);

        const category = await request({
            method: "POST",
            url: "/v1/categories",
            headers: { cookie },
            payload: { name: "Integration Category", slug: "integration-category" },
        });
        assert.equal(category.statusCode, 201);
        categoryId = category.json().data.id;

        const tag = await request({
            method: "POST",
            url: "/v1/tags",
            headers: { cookie },
            payload: { name: "Integration Tag", slug: "integration-tag" },
        });
        assert.equal(tag.statusCode, 201);
        const tagId = tag.json().data.id as string;

        const post = await request({
            method: "POST",
            url: "/v1/posts",
            headers: { cookie },
            payload: {
                title: "Integration Post",
                description: "Integration description",
                content: "Integration content",
            },
        });
        assert.equal(post.statusCode, 201);
        postId = post.json().data.id as string;

        const postRead = await request({ method: "GET", url: `/v1/posts/${postId}` });
        assert.equal(postRead.statusCode, 200);

        const posts = await request({ method: "GET", url: "/v1/posts" });
        assert.equal(posts.statusCode, 200);

        const userPosts = await request({ method: "GET", url: `/v1/users/${userId}/posts` });
        assert.equal(userPosts.statusCode, 200);

        const tags = await request({ method: "GET", url: "/v1/tags" });
        assert.equal(tags.statusCode, 200);

        const attachTag = await request({
            method: "POST",
            url: `/v1/posts/${postId}/tags`,
            headers: { cookie },
            payload: { tagId },
        });
        assert.equal(attachTag.statusCode, 201);

        const attachCategory = await request({
            method: "PUT",
            url: `/v1/posts/${postId}/category`,
            headers: { cookie },
            payload: { categoryId },
        });
        assert.equal(attachCategory.statusCode, 200);

        const search = await request({ method: "GET", url: "/v1/search?q=Integration&type=all" });
        assert.equal(search.statusCode, 200);
        assert.equal(search.json().data.posts.length, 1);

        const update = await request({
            method: "PATCH",
            url: `/v1/posts/${postId}`,
            headers: { cookie },
            payload: { title: "Updated Integration Post" },
        });
        assert.equal(update.statusCode, 200);

        const updateUser = await request({
            method: "PATCH",
            url: `/v1/users/${userId}`,
            headers: { cookie },
            payload: { name: "Updated Integration User" },
        });
        assert.equal(updateUser.statusCode, 200);

        const signupSecond = await request({
            method: "POST",
            url: "/v1/auth/sign-up/email",
            payload: {
                name: "Integration User Two",
                email: secondEmail,
                password: "integration-password-456",
                registrationToken,
            },
        });
        assert.ok([200, 201].includes(signupSecond.statusCode), signupSecond.body);
        secondCookie = extractCookie(signupSecond);
        assert.notEqual(secondCookie, "");

        const forbiddenUpdate = await request({
            method: "PATCH",
            url: `/v1/posts/${postId}`,
            headers: { cookie: secondCookie },
            payload: { title: "Forbidden" },
        });
        assert.equal(forbiddenUpdate.statusCode, 403);

        const forbiddenDelete = await request({
            method: "DELETE",
            url: `/v1/posts/${postId}`,
            headers: { cookie: secondCookie },
        });
        assert.equal(forbiddenDelete.statusCode, 403);

        const tagPosts = await request({ method: "GET", url: `/v1/tags/${tagId}/posts` });
        assert.equal(tagPosts.statusCode, 200);
        assert.equal(tagPosts.json().pagination.total, 1);

        const categoryPosts = await request({ method: "GET", url: `/v1/categories/${categoryId}/posts` });
        assert.equal(categoryPosts.statusCode, 200);
        assert.equal(categoryPosts.json().pagination.total, 1);

        const logout = await request({
            method: "POST",
            url: "/v1/auth/sign-out",
            headers: { cookie },
        });
        assert.equal(logout.statusCode, 200);

        const afterLogout = await request({ method: "GET", url: "/v1/me", headers: { cookie } });
        assert.equal(afterLogout.statusCode, 401);
    } finally {
        await app.close();
        await prisma.$disconnect();
    }
});
