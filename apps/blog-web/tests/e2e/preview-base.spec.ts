import { expect, test } from "@playwright/test";
import { hoverCard, scrollToFilmChapter } from "./home-card-helpers";

test.skip(!process.env.PREVIEW_BASE_PATH, "Requires a subpath production preview.");
test.use({ serviceWorkers: "block", reducedMotion: "reduce" });

test("subpath Home can grab a loaded photo card", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.goto(process.env.PREVIEW_BASE_PATH!);
  await expect(page.getByTestId("home-film")).toBeVisible();
  await expect(page.locator(".film-splash")).toHaveCount(0);
  await scrollToFilmChapter(page, "collect");
  const flight = page.locator("[data-home-flight]");
  await expect(flight).toHaveAttribute("data-home-flight-ready", "true");
  await hoverCard(page);
  await page.mouse.down();
  await expect(flight).toHaveAttribute("data-home-card-dragging", "true");
  await page.screenshot({ path: info.outputPath("preview-photo-grab.png") });
  await page.mouse.up();
});

test("subpath Works cards load their local icons from the preview", async ({ page }) => {
  const base = process.env.PREVIEW_BASE_PATH!;
  const icon = page.waitForResponse(response => new URL(response.url()).pathname === `${base}site-icons/weather.svg`);
  await page.goto(`${base}works`);
  const response = await icon;
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
});

test("subpath preview keeps author redirects and article navigation inside its base", async ({ page }) => {
  const base = process.env.PREVIEW_BASE_PATH!;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}author/2`);
  await expect(page).toHaveURL(new RegExp(`${base}#about$`));
  await page.goto(`${base}posts/go-basics-02-input-output?topic=languages`);
  await expect(page.getByTestId("post-view-article")).toBeVisible();
  await page.getByTestId("post-view-next-link").click();
  await expect(page).toHaveURL(new RegExp(`${base}posts/.*topic=languages`));
  await expect(page.getByTestId("post-view-article")).toBeVisible();
  await page.getByTestId("post-view-back-link").click();
  await expect(page).toHaveURL(new RegExp(`${base}blog\\?topic=languages$`));
  expect(errors).toEqual([]);
});
