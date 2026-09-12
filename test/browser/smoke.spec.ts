import { expect, test } from "@playwright/test";

test.describe("public frontend", () => {
    test("home page renders", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveTitle(/imshare/i);
        await expect(page.locator("header")).toBeVisible();
    });

    test("navigation is usable on desktop", async ({ page }) => {
        await page.goto("/");

        await expect(page.getByRole("link", { name: "imshare" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Posts" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Search" })).toBeVisible();
        await expect(page.getByRole("button", { name: /dark mode|light mode/i })).toBeVisible();
        await expect(page.getByRole("link", { name: "Notifications" })).toBeVisible();
    });

    test("mobile navigation opens and closes", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/");

        const openButton = page.getByRole("button", { name: "Open navigation" });
        await expect(openButton).toBeVisible();
        await openButton.click();

        await expect(page.getByRole("button", { name: "Close navigation" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Posts" })).toBeVisible();

        await page.getByRole("button", { name: "Close navigation" }).click();
        await expect(page.getByRole("button", { name: "Close navigation" })).toBeHidden();
    });

    test("public pages return real HTML", async ({ page }) => {
        const paths = [
            "/",
            "/posts/",
            "/posts/new/",
            "/posts/test-post/",
            "/account/",
            "/account/login/",
            "/account/register/",
            "/account/notifications/",
            "/account/profile/",
            "/account/sessions/",
            "/notifications/",
            "/users/",
            "/tags/",
            "/categories/",
            "/search/",
            "/about/",
            "/faq/",
            "/github/",
            "/privacy/",
            "/terms/",
            "/admin/",
        ];

        for (const path of paths) {
            const response = await page.goto(path);
            expect(response?.status(), path).toBe(200);
            await expect(page.locator("body"), path).not.toBeEmpty();
        }
    });

    test("public taxonomy and profile detail pages render", async ({ page }) => {
        for (const path of [
            "/users/test-user/",
            "/users/test-user/posts/",
            "/tags/test-tag/",
            "/tags/test-tag/posts/",
            "/categories/test-category/",
            "/categories/test-category/posts/",
        ]) {
            const response = await page.goto(path);
            expect(response?.status(), path).toBe(200);
            await expect(page.locator("body"), path).not.toBeEmpty();
        }
    });

    test("footer exposes FAQ, GitHub, and version", async ({ page }) => {
        await page.goto("/");

        const footer = page.getByRole("contentinfo");
        await expect(footer).toBeVisible();
        await expect(footer.getByRole("link", { name: "FAQ" })).toBeVisible();
        await expect(footer.getByRole("link", { name: "GitHub" })).toBeVisible();
        await expect(footer).toContainText(/Version/i);
    });

    test("FAQ keeps its grouped heading structure", async ({ page }) => {
        await page.goto("/faq/");

        await expect(page.getByRole("heading", { name: "FAQs", level: 1 })).toBeVisible();
        await expect(page.getByRole("heading", { name: "About imshare", level: 2 })).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "Images and privacy", level: 2 }),
        ).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "Who can access my images?", level: 3 }),
        ).toBeVisible();
    });
});

test.describe("dashboard frontend", () => {
    test("dashboard management pages render", async ({ page }) => {
        const paths = [
            "/dashboard/",
            "/dashboard/posts/",
            "/dashboard/tags/",
            "/dashboard/categories/",
            "/dashboard/settings/",
        ];

        for (const path of paths) {
            const response = await page.goto(path);
            expect(response?.status(), path).toBe(200);
            await expect(page.locator("body"), path).not.toBeEmpty();
        }
    });

    test("dashboard post management routes render", async ({ page }) => {
        for (const path of [
            "/dashboard/posts/test-post/",
            "/dashboard/posts/test-post/edit/",
        ]) {
            const response = await page.goto(path);
            expect(response?.status(), path).toBe(200);
            await expect(page.locator("body"), path).not.toBeEmpty();
        }
    });

    test("dashboard post list mounts its React entry", async ({ page }) => {
        await page.goto("/dashboard/posts/");

        await expect(page.locator('script[src="/client/dashboardPosts.js"]')).toHaveCount(1);
        await expect(page.locator("#dashboard-posts-page")).toBeVisible();
        await expect(page).toHaveURL(/\/account\/login\/$|\/dashboard\/posts\/$/);
    });

    test("dashboard taxonomy pages mount the shared React entry", async ({ page }) => {
        for (const [path, label] of [
            ["/dashboard/tags/", "Manage Tags"],
            ["/dashboard/categories/", "Manage Categories"],
        ] as const) {
            await page.goto(path);
            await expect(page.locator('script[src="/client/taxonomy.js"]')).toHaveCount(1);
            await expect(page.locator("#taxonomy-page")).toBeVisible();
            await expect(page.getByRole("heading", { name: label })).toBeVisible();
        }
    });
});
