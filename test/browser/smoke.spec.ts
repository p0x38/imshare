import { expect, test } from "@playwright/test";

test.describe("public frontend", () => {
    test("home page renders", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveTitle(/imshare/i);
        await expect(page.locator("header")).toBeVisible();
    });

    test("main page entrance motion is wired", async ({ page }) => {
        await page.goto("/");
        const motion = page.locator("main").first().locator("..");
        await expect(motion).toBeVisible();
        await expect.poll(async () => motion.evaluate((element) => getComputedStyle(element).animationName)).toContain("imshare-page-enter");
        const keyframes = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            return sheets.some((sheet) => {
                try {
                    return Array.from(sheet.cssRules).some((rule) => rule.cssText.includes("imshare-page-enter"));
                } catch {
                    return false;
                }
            });
        });
        expect(keyframes).toBe(true);
    });

    test("interaction motion uses the shared transitions", async ({ page }) => {
        await page.route("**/v1/posts?*", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    data: [{ id: "motion-test", title: "Motion test", uploads: [], authorName: "Test" }],
                    pagination: { page: 1, totalPages: 1 },
                }),
            });
        });
        await page.goto("/posts/");

        const searchField = page.getByRole("textbox", { name: "Search posts" });
        const labelTransition = await searchField.locator("..", { has: searchField }).locator("label").evaluate((element) => {
            const style = getComputedStyle(element);
            return { property: style.transitionProperty, duration: style.transitionDuration };
        });
        expect(labelTransition.property).toContain("transform");
        expect(Number.parseFloat(labelTransition.duration)).toBeGreaterThan(0.2);

        const searchButton = page.getByRole("button", { name: "Search" });
        const buttonBefore = await searchButton.evaluate((element) => {
            const style = getComputedStyle(element);
            return { transition: style.transition, transform: style.transform };
        });
        expect(buttonBefore.transition).toContain("transform");

        await searchButton.hover();
        await expect.poll(async () => searchButton.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");

        const card = page.locator(".MuiCard-root").filter({ hasText: "Motion test" }).first();
        await expect(card).toBeVisible();
        await card.hover();
        await expect.poll(async () => card.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
    });

    test("button ripple is visibly animated", async ({ page }) => {
        await page.route("**/v1/posts?*", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ data: [], pagination: { page: 1, totalPages: 1 } }),
            });
        });
        await page.goto("/posts/");
        const button = page.getByRole("button", { name: "Search" });
        await button.click({ position: { x: 4, y: 4 } });
        const ripple = button.locator(".MuiTouchRipple-rippleVisible");
        await expect(ripple).toBeVisible();
        await expect.poll(async () => ripple.evaluate((element) => getComputedStyle(element).animationName)).toContain("imshare-ripple");
        await expect.poll(async () => ripple.evaluate((element) => getComputedStyle(element).animationDuration)).toBe("0.52s");
    });

    test("reduced-motion mode disables custom motion", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("/posts/");

        const pageMotion = page.locator("main").first().locator("..");
        await expect(pageMotion).toBeVisible();
        await expect(pageMotion).toHaveCSS("animation-name", /^(none|unset)$/i);

        const button = page.getByRole("button", { name: "Search" });
        await expect(button).toHaveCSS("transition-duration", "0s");
    });

    test("color mode toggle persists its state", async ({ page }) => {
        await page.goto("/");
        const toggle = page.getByRole("button", { name: /dark mode|light mode/i });
        const initial = await page.locator("html").evaluate((element) => getComputedStyle(element).colorScheme);
        await toggle.click();
        await expect.poll(async () => page.locator("html").evaluate((element) => getComputedStyle(element).colorScheme)).not.toBe(initial);
        const stored = await page.evaluate(() => localStorage.getItem("imshare-color-mode"));
        expect(stored).toMatch(/^(light|dark)$/);
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
        await expect(openButton).toHaveCSS("min-width", /.+/);
        await openButton.click();
        await expect(page.getByRole("button", { name: "Close navigation" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Posts" })).toBeVisible();
        await page.getByRole("button", { name: "Close navigation" }).click();
        await expect(page.getByRole("button", { name: "Close navigation" })).toBeHidden();
    });

    test("public pages return real HTML", async ({ page }) => {
        const paths = [
            "/", "/posts/", "/posts/new/", "/posts/test-post/", "/account/",
            "/account/login/", "/account/register/", "/account/notifications/",
            "/account/profile/", "/account/sessions/", "/notifications/", "/users/",
            "/tags/", "/categories/", "/search/", "/about/", "/faq/", "/github/",
            "/privacy/", "/terms/", "/admin/",
        ];
        for (const path of paths) {
            const response = await page.goto(path);
            expect(response?.status(), path).toBe(200);
            await expect(page.locator("body"), path).not.toBeEmpty();
        }
    });

    test("public taxonomy and profile detail pages render", async ({ page }) => {
        for (const path of [
            "/users/test-user/", "/users/test-user/posts/", "/tags/test-tag/",
            "/tags/test-tag/posts/", "/categories/test-category/", "/categories/test-category/posts/",
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
        await expect(page.getByRole("heading", { name: "FAQs", level: 1 })).toBeVisible();
        await expect(page.getByRole("heading", { name: "About imshare", level: 2 })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Images and privacy", level: 2 })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Who can access my images?", level: 3 })).toBeVisible();
    });
});

test.describe("dashboard frontend", () => {
    const managementPaths = [
        "/dashboard/", "/dashboard/posts/", "/dashboard/posts/test-post/",
        "/dashboard/posts/test-post/edit/", "/dashboard/tags/", "/dashboard/categories/",
        "/dashboard/settings/",
    ];

    test("dashboard management routes serve HTML shells", async ({ request }) => {
        for (const path of managementPaths) {
            const response = await request.get(path, { maxRedirects: 0 });
            expect(response.status(), path).toBe(200);
            const html = await response.text();
            expect(html, path).toMatch(/<main\b/i);
            expect(html, path).toMatch(/<script[^>]+type=["']module["']/i);
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

    test("dashboard post management routes expose their controls", async ({ request }) => {
        const view = await request.get("/dashboard/posts/test-post/");
        expect(view.status()).toBe(200);
        const viewHtml = await view.text();
        expect(viewHtml).toContain("Edit");
        expect(viewHtml).toContain("Delete this post?");

        const edit = await request.get("/dashboard/posts/test-post/edit/");
        expect(edit.status()).toBe(200);
        const editHtml = await edit.text();
        expect(editHtml).toContain("Edit Post");
        expect(editHtml).toContain('id="form"');
        expect(editHtml).toContain("Save changes");
    });
});
