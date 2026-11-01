import { expect, test } from "@playwright/test";

test.skip(!process.env.PREVIEW_BASE_PATH, "Requires a subpath production preview.");
test.use({ serviceWorkers: "block", reducedMotion: "reduce" });

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
