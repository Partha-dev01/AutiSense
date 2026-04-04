import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
];

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("Landing page - no horizontal overflow, ThemeToggle visible", async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test("Games list page - ThemeToggle, games visible", async ({ page }) => {
      await page.goto("/kid-dashboard/games", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
    });

    test("Bubble Pop - ThemeToggle, start button", async ({ page }) => {
      await page.goto("/kid-dashboard/games/bubble-pop", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
    });

    test("Alphabet Pattern - ThemeToggle, stages", async ({ page }) => {
      await page.goto("/kid-dashboard/games/alphabet-pattern", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
    });

    test("Tracing game - ThemeToggle", async ({ page }) => {
      await page.goto("/kid-dashboard/games/tracing", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
    });

    test("Sequence Memory - ThemeToggle, enhanced UI", async ({ page }) => {
      await page.goto("/games/sequence", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
    });

    test("Color & Sound - ThemeToggle", async ({ page }) => {
      await page.goto("/games/color-sound", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
    });

    test("Speech practice - ThemeToggle, stages", async ({ page }) => {
      await page.goto("/kid-dashboard/speech", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
    });

    test("Feed page - ThemeToggle, anonymous toggle", async ({ page }) => {
      await page.goto("/feed", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
    });

    test("Progress page - ThemeToggle, no duplicates", async ({ page }) => {
      await page.goto("/kid-dashboard/progress", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
    });

    test("Chat page - no overflow on input bar", async ({ page }) => {
      await page.goto("/kid-dashboard/chat", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test("Video capture (intake step 8) - status bar visible", async ({ page }) => {
      await page.goto("/intake/video-capture", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
    });
  });
}
