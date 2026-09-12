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
        for (const path of ["/", "/posts/", "/account/login/", "/account/register/"]) {
            const response = await page.goto(path);
            expect(response?.status(), path).toBe(200);
            await expect(page.locator("body")).not.toBeEmpty();
        }
    });
});
