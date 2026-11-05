import { hoverCard } from "./home-card-helpers";
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

test("Home retains its original background, geometry focus and navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const flight = page.locator("[data-home-flight]");
  await expect(flight).toHaveAttribute("data-home-flight-ready", "true");
  await expect(flight).toHaveAttribute("data-home-flight", "active");
  const modeToggle = page.getByRole("switch", { name: "拾光模式" });
  await expect(modeToggle).toBeVisible();
  await expect(modeToggle).toHaveAttribute("aria-checked", "true");
  await modeToggle.click();
  await expect(flight).toHaveAttribute("data-home-flight", "inactive");
  await modeToggle.press("Enter");
  await expect(flight).toHaveAttribute("data-home-flight", "active");
  await expect(page.locator("[data-home-flight-rays]")).toHaveCount(0);
  await expect(page.locator("[data-scene-layer] canvas")).toHaveCount(1);

  // Collect geometry must never enter immersion, in either theme.
  for (const theme of ["night", "day"]) {
    await page.mouse.click(825.5, 871 * 0.512 - 35);
    await expect(page.getByRole("button", { name: /沉浸模式/ })).toHaveCount(0);
    await expect(page.getByText("抓住一张卡片，读一段时光")).toBeVisible();
    if (theme === "night") await page.locator('[data-nav-theme-toggle="desktop"]').click();
  }
  await modeToggle.click();
  await expect(flight).toHaveAttribute("data-home-flight", "inactive");
  // Hit the visible band, not the empty center of the Möbius ring.
  await page.mouse.move(825.5, 200);
  await expect(flight).toHaveClass(/cursor-pointer/);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByRole("button", { name: /沉浸模式/ })).toBeVisible();
  await page.getByRole("button", { name: /沉浸模式/ }).press("Enter");
  await expect(flight).toHaveAttribute("data-home-flight", "inactive");
  await expect(page.getByText("点击莫比乌斯带进行探索")).toBeVisible();
  await modeToggle.click();
  await expect(flight).toHaveAttribute("data-home-flight", "active");

  await page.locator('[data-nav-theme-toggle="desktop"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.getByText("抓住一张卡片，读一段时光")).toBeVisible();
  await page.locator('[data-nav-item="blog"]').first().click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(flight).toHaveAttribute("data-home-flight", "inactive");
  await expect(page.locator("[data-scene-blog-dock]")).toBeVisible();
  await page.getByRole("link", { name: "WOODFISH", exact: true }).click();
  await expect(flight).toHaveAttribute("data-home-flight", "active");
  expect(errors).toEqual([]);
});

test("a foreground Home card captures the pointer without focusing the geometry", async ({ page }) => {
  await page.goto("/");
  const flight = page.locator("[data-home-flight]");
  await expect(flight).toHaveAttribute("data-home-flight-ready", "true");
  await page.waitForTimeout(100);
  await hoverCard(page);
  await page.mouse.down();
  await expect(flight).toHaveAttribute("data-home-card-dragging", "true");
  await page.mouse.move(1100, 650, { steps: 12 });
  await expect(page.getByRole("button", { name: /沉浸模式/ })).toHaveCount(0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: "../../experiments/wodniack-cards/evidence/poetry/desktop-grab.png" });
  await page.mouse.up();
  await expect(flight).toHaveAttribute("data-home-card-dragging", "false");
  await expect(flight).toHaveAttribute("data-home-flight", "active");
});
