import assert from "node:assert/strict";
import test from "node:test";

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

    const request = (options: Parameters<typeof app.inject>[0]) => app.inject(options);

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
            payload: { name: "Integration User", email, password: "integration-password-123", registrationToken },
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
        assert.ok([200, 201].includes(category.statusCode), category.body);
        categoryId = category.json().data.id as string;

        const tag = await request({
            method: "POST",
            url: "/v1/tags",
            headers: { cookie },
            payload: { name: "Integration Tag", slug: "integration-tag" },
        });
        assert.ok([200, 201].includes(tag.statusCode), tag.body);
        const tagId = tag.json().data.id as string;

        const post = await request({
            method: "POST",
            url: "/v1/posts",
            headers: { cookie },
            payload: { title: "Integration Post", description: "Integration description", body: "Integration body" },
        });
        assert.ok([200, 201].includes(post.statusCode), post.body);
        postId = post.json().data.id as string;

        const postRead = await request({ method: "GET", url: `/v1/posts/${postId}` });
        assert.equal(postRead.statusCode, 200);

        const posts = await request({ method: "GET", url: "/v1/posts" });
        assert.equal(posts.statusCode, 200);
        assert.equal(posts.json().pagination.total, 1);

        const userPosts = await request({ method: "GET", url: `/v1/users/${userId}/posts` });
        assert.equal(userPosts.statusCode, 200);
        assert.equal(userPosts.json().pagination.total, 1);

        const tags = await request({ method: "GET", url: "/v1/tags" });
        assert.equal(tags.statusCode, 200);

        const attachTag = await request({
            method: "POST",
            url: `/v1/posts/${postId}/tags`,
            headers: { cookie },
            payload: { tagId },
        });
        assert.equal(attachTag.statusCode, 200);

        const attachCategory = await request({
            method: "POST",
            url: `/v1/posts/${postId}/categories`,
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
            payload: { title: "Integration Post Updated" },
        });
        assert.equal(update.statusCode, 200);

        const updateUser = await request({
            method: "PATCH",
            url: "/v1/me",
            headers: { cookie },
            payload: { bio: "Integration bio" },
        });
        assert.equal(updateUser.statusCode, 200);

        const secondSignup = await request({
            method: "POST",
            url: "/v1/auth/sign-up/email",
            payload: {
                name: "Integration Second User",
                email: secondEmail,
                password: "integration-password-123",
                registrationToken,
            },
        });
        assert.ok([200, 201].includes(secondSignup.statusCode), secondSignup.body);
        secondCookie = extractCookie(secondSignup);
        assert.notEqual(secondCookie, "");

        const forbiddenUpdate = await request({
            method: "PATCH",
            url: `/v1/posts/${postId}`,
            headers: { cookie: secondCookie },
            payload: { title: "Forbidden Update" },
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
            headers: { cookie, host: "localhost:5454", origin: "http://localhost:5454" },
        });
        assert.equal(logout.statusCode, 200);

        const afterLogout = await request({ method: "GET", url: "/v1/me", headers: { cookie } });
        assert.equal(afterLogout.statusCode, 401);
    } finally {
        await app.close();
        await prisma.$disconnect();
    }
});
