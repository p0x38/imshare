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
                description: "Created by the integration suite.",
                categoryId,
                tags: ["Generated Tag"],
            },
        });
        assert.equal(post.statusCode, 201, post.body);
        postId = post.json().data.id;
        assert.equal(post.json().data.author.id, userId);
        assert.equal(post.json().data.category.id, categoryId);
        assert.equal(post.json().data.tags[0].name, "generated tag");

        const postRead = await request({ method: "GET", url: `/v1/posts/${postId}` });
        assert.equal(postRead.statusCode, 200);
        assert.equal(postRead.json().data.id, postId);

        const postList = await request({ method: "GET", url: "/v1/posts?search=Integration%20Post" });
        assert.equal(postList.statusCode, 200);
        assert.equal(postList.json().pagination.total, 1);

        const userPosts = await request({ method: "GET", url: `/v1/users/${userId}/posts` });
        assert.equal(userPosts.statusCode, 200);
        assert.equal(userPosts.json().data[0].id, postId);

        const postTags = await request({ method: "GET", url: `/v1/posts/${postId}/tags` });
        assert.equal(postTags.statusCode, 200);
        assert.equal(postTags.json().data[0].name, "generated tag");

        const attachTag = await request({ method: "POST", url: `/v1/posts/${postId}/tags`, headers: { cookie }, payload: { tagId } });
        assert.equal(attachTag.statusCode, 201);

        const attachCategory = await request({ method: "PUT", url: `/v1/posts/${postId}/category`, headers: { cookie }, payload: { categoryId } });
        assert.equal(attachCategory.statusCode, 200);

        const search = await request({ method: "GET", url: "/v1/search?q=Integration&type=all" });
        assert.equal(search.statusCode, 200);
        assert.equal(search.json().data.posts.length, 1);
        assert.ok(search.json().data.users.length >= 1);
        assert.ok(search.json().data.tags.length >= 1);
        assert.ok(search.json().data.categories.length >= 1);

        const update = await request({ method: "PATCH", url: `/v1/posts/${postId}`, headers: { cookie }, payload: { title: "Updated Integration Post" } });
        assert.equal(update.statusCode, 200);
        assert.equal(update.json().data.title, "Updated Integration Post");

        const ownUserUpdate = await request({ method: "PATCH", url: `/v1/users/${userId}`, headers: { cookie }, payload: { name: "Renamed Integration User" } });
        assert.equal(ownUserUpdate.statusCode, 200);
        assert.equal(ownUserUpdate.json().data.name, "Renamed Integration User");

        const secondSignup = await request({
            method: "POST",
            url: "/v1/auth/sign-up/email",
            payload: { name: "Second Integration User", email: secondEmail, password: "integration-password-456", registrationToken },
        });
        assert.ok([200, 201].includes(secondSignup.statusCode), secondSignup.body);
        secondCookie = extractCookie(secondSignup);
        assert.notEqual(secondCookie, "");

        const forbiddenPostUpdate = await request({ method: "PATCH", url: `/v1/posts/${postId}`, headers: { cookie: secondCookie }, payload: { title: "Should Be Rejected" } });
        assert.equal(forbiddenPostUpdate.statusCode, 403);

        const forbiddenPostDelete = await request({ method: "DELETE", url: `/v1/posts/${postId}`, headers: { cookie: secondCookie } });
        assert.equal(forbiddenPostDelete.statusCode, 403);

        const tagPosts = await request({ method: "GET", url: `/v1/tags/${tagId}/posts` });
        assert.equal(tagPosts.statusCode, 200);
        assert.equal(tagPosts.json().pagination.total, 1);

        const categoryPosts = await request({ method: "GET", url: `/v1/categories/${categoryId}/posts` });
        assert.equal(categoryPosts.statusCode, 200);
        assert.equal(categoryPosts.json().pagination.total, 1);

        const logout = await request({
            method: "POST",
            url: "/v1/auth/sign-out",
            headers: { cookie, origin: "http://localhost:5454" },
        });
        assert.equal(logout.statusCode, 200);

        const afterLogout = await request({ method: "GET", url: "/v1/me", headers: { cookie } });
        assert.equal(afterLogout.statusCode, 401);
    } finally {
        await app.close();
        await prisma.$disconnect();
    }
});
