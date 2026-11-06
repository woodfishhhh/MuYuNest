import { hoverCard, hoverGeometry, scrollToFilmChapter } from "./home-card-helpers";
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1651, height: 871 }, contextOptions: { reducedMotion: "reduce" } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("vuecubeblog-theme", "night");
    // Freeze the random warm-start layout; autonomous movement is disabled by
    // reduced-motion, while explicit pointer interactions remain live.
    Math.random = () => 0.5;
  });
});

test("the film drops cards only in its 拾光 chapter and lets the geometry focus only in the opening", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const flight = page.locator("[data-home-flight]");
  await expect(page.locator("[data-scene-layer] canvas")).toHaveCount(1);
  await expect(flight).toHaveAttribute("data-home-film-chapter", "opening");
  await expect(flight).toHaveAttribute("data-home-flight", "inactive");

  await scrollToFilmChapter(page, "collect");
  await expect(flight).toHaveAttribute("data-home-flight-ready", "true");
  await expect(flight).toHaveAttribute("data-home-flight", "active");
  await expect(page.locator("[data-home-flight-rays]")).toHaveCount(0);
  await expect(page.getByText("抓住一张卡片，读一段时光")).toBeVisible();

  // Collect geometry must never enter immersion, in either theme.
  for (const theme of ["night", "day"]) {
    await page.mouse.click(825.5, 871 * 0.512 - 35);
    await expect(page.getByRole("button", { name: /沉浸模式/ })).toHaveCount(0);
    if (theme === "night") await page.locator('[data-nav-theme-toggle="desktop"]').click();
  }

  // Scrolling back up plays the film in reverse: the cards leave with their chapter.
  await scrollToFilmChapter(page, "opening", 0);
  await expect(flight).toHaveAttribute("data-home-flight", "inactive");
  await hoverGeometry(page);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByRole("button", { name: /沉浸模式/ })).toBeVisible();
  await page.getByRole("button", { name: /沉浸模式/ }).press("Enter");
  await expect(flight).toHaveAttribute("data-home-flight", "inactive");

  await page.locator('[data-nav-item="blog"]').first().click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(flight).toHaveAttribute("data-home-flight", "inactive");
  await expect(page.locator("[data-scene-blog-dock]")).toBeVisible();
  await page.getByRole("link", { name: "WOODFISH", exact: true }).click();
  await expect(flight).toHaveAttribute("data-home-film-chapter", "opening");
  await expect(flight).toHaveAttribute("data-home-flight", "inactive");
  expect(errors).toEqual([]);
});

test("a foreground Home card captures the pointer without focusing the geometry", async ({ page }) => {
  await page.goto("/");
  const flight = page.locator("[data-home-flight]");
  await scrollToFilmChapter(page, "collect");
  await expect(flight).toHaveAttribute("data-home-flight-ready", "true");
  await page.waitForTimeout(100);
  await hoverCard(page);
  await page.mouse.down();
  await expect(flight).toHaveAttribute("data-home-card-dragging", "true");
  await page.mouse.move(1100, 650, { steps: 12 });
  await expect(page.getByRole("button", { name: /沉浸模式/ })).toHaveCount(0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: "../../output/blog-web-visual/desktop-grab.png" });
  await page.mouse.up();
  await expect(flight).toHaveAttribute("data-home-card-dragging", "false");
  await expect(flight).toHaveAttribute("data-home-flight", "active");
});
