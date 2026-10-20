import { expect, test } from "@playwright/test";
import { hoverCard } from "./home-card-helpers";

test("Home switches a held card theme without releasing or restarting it", async ({ page }) => {
  await page.setViewportSize({ width: 1651, height: 871 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("vuecubeblog-theme", "night");
    Math.random = () => 0.5;
  });
  await page.goto("/");
  const flight = page.locator("[data-home-flight]");
  await expect(flight).toHaveAttribute("data-home-flight-ready", "true");
  await hoverCard(page);
  await page.mouse.down();
  await page.mouse.move(1100, 650, { steps: 12 });
  await expect(flight).toHaveAttribute("data-home-card-dragging", "true");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "../../experiments/selected-rays/evidence/home-night.png" });
  await page.locator('[data-nav-theme-toggle="desktop"]').press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  await expect(flight).toHaveAttribute("data-home-card-dragging", "true");
  await page.screenshot({ path: "../../experiments/selected-rays/evidence/home-day.png" });
  await page.mouse.up();
  await expect(flight).toHaveAttribute("data-home-card-dragging", "false");
});

test("poems and photo frames switch between soft dark and light surfaces", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vuecubeblog-theme", "night"));
  await page.goto("/playground/home-cards");
  const poem = page.locator('figure[data-card-type="text"] canvas').first();
  const photo = page.locator('figure[data-card-id="photo-lens-01"] canvas');
  await expect(poem).toBeVisible(); await expect(photo).toBeVisible();
  const pixel = (canvas: typeof poem, x: number, y: number) => canvas.evaluate((el, point) =>
    Array.from((el as HTMLCanvasElement).getContext("2d")!.getImageData(point.x, point.y, 1, 1).data), { x, y });
  const photoRequests: string[] = [];
  page.on("request", req => { if (/photo-01.*\.webp/.test(req.url())) photoRequests.push(req.url()); });
  const darkPaper = await pixel(poem, 40, 40);
  const darkMat = await pixel(photo, 40, 40);
  expect(Math.max(...darkPaper.slice(0, 3))).toBeLessThan(50);
  expect(Math.max(...darkMat.slice(0, 3))).toBeLessThan(50);
  await page.screenshot({ path: "../../experiments/selected-rays/evidence/cards-night.png" });
  await page.getByRole("button", { name: "切到白天" }).click();
  await expect.poll(async () => (await pixel(poem, 40, 40))[0]).toBeGreaterThan(220);
  await expect.poll(async () => (await pixel(photo, 40, 40))[0]).toBeGreaterThan(220);
  await page.screenshot({ path: "../../experiments/selected-rays/evidence/cards-day.png" });
  await page.getByRole("button", { name: "切到夜晚" }).click();
  await expect.poll(() => pixel(poem, 40, 40)).toEqual(darkPaper);
  await expect.poll(() => pixel(photo, 40, 40)).toEqual(darkMat);
  expect(photoRequests).toEqual([]);
});
