import { expect, test } from "@playwright/test";

test.describe("public frontend", () => {
    test("home page renders", async ({ page }) => {
        const response = await page.goto("/", { waitUntil: "domcontentloaded" });
        expect(response?.status()).toBe(200);
        await expect(page).toHaveTitle("imshare");
        await expect(page.locator("header")).toBeVisible();
    });

    test("initial loading screen is replaced when React mounts", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("status").filter({ hasText: /loading/i })).toBeHidden();
        await expect(page.locator("header")).toBeVisible();
    });

    test("posts page exposes skeletons while its data is pending", async ({ page }) => {
        await page.route("**/v1/posts?*", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 700));
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ data: [], pagination: { page: 1, totalPages: 1 } }),
            });
        });
        await page.goto("/posts/");
        const skeletons = page.locator('[aria-label="Loading posts"]');
        await expect(skeletons).toBeVisible();
        await expect(skeletons.locator(".MuiSkeleton-root").first()).toBeVisible();
        await expect(skeletons).toBeHidden({ timeout: 3_000 });
    });

    test("main page entrance motion is wired", async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                "imshare-theme-settings",
                JSON.stringify({ animations: true, ripple: false, accentColor: "default" }),
            );
        });
        await page.goto("/");
        const motion = page.locator("main:has(> h1)").first().locator("..");
        await expect(motion).toBeVisible();
        await expect
            .poll(async () => motion.evaluate((element) => getComputedStyle(element).willChange))
            .toContain("opacity");
    });

    test("button ripple is enabled by the theme preference", async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                "imshare-theme-settings",
                JSON.stringify({ animations: false, ripple: true, accentColor: "default" }),
            );
        });
        await page.route("**/v1/posts?*", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ data: [], pagination: { page: 1, totalPages: 1 } }),
            });
        });
        await page.goto("/posts/");
        const button = page.getByRole("button", { name: "Search" });
        const ripple = button.locator(".MuiTouchRipple-ripple");
        await button.dispatchEvent("mousedown", { button: 0, bubbles: true });
        await expect(ripple).toBeVisible();
        await button.dispatchEvent("mouseup", { button: 0, bubbles: true });
    });

    test("color mode toggle persists its state", async ({ page }) => {
        await page.goto("/");
        const toggle = page.getByRole("button", { name: /dark mode|light mode/i });
        await toggle.click();
        const stored = await page.evaluate(() => localStorage.getItem("imshare-color-mode"));
        expect(stored).toMatch(/^(light|dark)$/);
        await page.reload();
        await expect
            .poll(() => page.evaluate(() => localStorage.getItem("imshare-color-mode")))
            .toBe(stored);
    });

    test("settings can switch to automatic device mode", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "dark" });
        await page.goto("/dashboard/settings/");
        const automatic = page.getByLabel("Automatic (Device)");
        await expect(automatic).toBeVisible();
        await automatic.check();
        await expect(automatic).toBeChecked();
        await expect(page.locator("body")).toHaveCSS("background-color", "rgb(18, 18, 18)");
    });

    test("settings can switch language and persist it", async ({ page }) => {
        await page.goto("/dashboard/settings/");
        const japanese = page.getByLabel("日本語");
        await expect(japanese).toBeVisible();
        await japanese.check();
        await expect(japanese).toBeChecked();
        await expect(page.locator("html")).toHaveAttribute("lang", "ja");
        await expect(page.getByRole("heading", { name: "設定", level: 1 })).toBeVisible();
        await expect(page.evaluate(() => localStorage.getItem("imshare-language"))).resolves.toBe(
            "ja",
        );
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", "ja");
        await expect(page.getByRole("heading", { name: "設定", level: 1 })).toBeVisible();
    });

    test("mobile layout does not create horizontal overflow", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/");
        const dimensions = await page.evaluate(() => ({
            viewport: document.documentElement.clientWidth,
            content: document.documentElement.scrollWidth,
        }));
        expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
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

    test("footer exposes FAQ, GitHub, and version label", async ({ page }) => {
        await page.goto("/");
        const footer = page.getByRole("contentinfo");
        await expect(footer).toBeVisible();
        await expect(footer.getByRole("link", { name: "FAQ" })).toBeVisible();
        await expect(footer.getByRole("link", { name: "GitHub" })).toBeVisible();
        await expect(footer.getByLabel("Version")).toHaveAttribute("aria-label", "Version");
    });

    test("FAQ keeps its grouped heading structure", async ({ page }) => {
        await page.goto("/faq/");
        await expect(
            page.getByRole("heading", { name: "Frequently Asked Questions", level: 1 }),
        ).toBeVisible();
        await expect(page.getByRole("heading", { name: "About imshare", level: 2 })).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "Privacy and moderation", level: 2 }),
        ).toBeVisible();
        await expect(page.getByText("What is imshare?", { exact: true })).toBeVisible();
    });
});

test.describe("dashboard frontend", () => {
    const managementPaths = [
        "/dashboard/",
        "/dashboard/posts/",
        "/dashboard/posts/test-post/",
        "/dashboard/posts/test-post/edit/",
        "/dashboard/tags/",
        "/dashboard/categories/",
        "/dashboard/settings/",
    ];

    test("dashboard management routes serve React shells", async ({ request }) => {
        const expectedShells: Record<string, { root: string; script: string }> = {
            "/dashboard/": { root: "dashboard-page", script: "/client/dashboard.js" },
            "/dashboard/posts/": {
                root: "dashboard-posts-page",
                script: "/client/dashboardPosts.js",
            },
            "/dashboard/posts/test-post/": {
                root: "dashboard-post-page",
                script: "/client/dashboardPost.js",
            },
            "/dashboard/posts/test-post/edit/": {
                root: "post-editor-page",
                script: "/client/postEditor.js",
            },
            "/dashboard/tags/": { root: "taxonomy-page", script: "/client/taxonomy.js" },
            "/dashboard/categories/": { root: "taxonomy-page", script: "/client/taxonomy.js" },
            "/dashboard/settings/": { root: "settings-page", script: "/client/settings.js" },
        };
        for (const path of managementPaths) {
            const response = await request.get(path, { maxRedirects: 0 });
            expect(response.status(), path).toBe(200);
            const html = await response.text();
            expect(html, path).toContain(`id="${expectedShells[path]!.root}"`);
            expect(html, path).toContain(`src="${expectedShells[path]!.script}"`);
        }
    });

    test("dashboard landing shell mounts its React entry", async ({ request }) => {
        const response = await request.get("/dashboard/");
        expect(response.status()).toBe(200);
        const html = await response.text();
        expect(html).toContain('id="dashboard-page"');
        expect(html).toContain('src="/client/dashboard.js"');
    });

    test("dashboard post list mounts its React entry", async ({ request }) => {
        const response = await request.get("/dashboard/posts/");
        expect(response.status()).toBe(200);
        const html = await response.text();
        expect(html).toContain('id="dashboard-posts-page"');
        expect(html).toContain('src="/client/dashboardPosts.js"');
    });

    test("dashboard taxonomy pages mount the shared React entry", async ({ request }) => {
        for (const path of ["/dashboard/tags/", "/dashboard/categories/"]) {
            const response = await request.get(path);
            expect(response.status(), path).toBe(200);
            const html = await response.text();
            expect(html, path).toContain('id="taxonomy-page"');
            expect(html, path).toContain('src="/client/taxonomy.js"');
        }
    });

    test("dashboard settings mounts its React entry", async ({ request }) => {
        const response = await request.get("/dashboard/settings/");
        expect(response.status()).toBe(200);
        const html = await response.text();
        expect(html).toContain('id="settings-page"');
        expect(html).toContain('src="/client/settings.js"');
    });

    test("dashboard post management routes mount their React entries", async ({ request }) => {
        const view = await request.get("/dashboard/posts/test-post/");
        expect(view.status()).toBe(200);
        const viewHtml = await view.text();
        expect(viewHtml).toContain('id="dashboard-post-page"');
        expect(viewHtml).toContain('src="/client/dashboardPost.js"');
        const edit = await request.get("/dashboard/posts/test-post/edit/");
        expect(edit.status()).toBe(200);
        const editHtml = await edit.text();
        expect(editHtml).toContain('id="post-editor-page"');
        expect(editHtml).toContain('src="/client/postEditor.js"');
    });
});
