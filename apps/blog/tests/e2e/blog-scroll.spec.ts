import { expect, test } from "@playwright/test";

test("scrolling up at the top of Blog returns to Home", async ({ page }) => {
  await page.goto("/blog");

  const blogPanel = page.locator("[data-panel-layer='blog']");
  await expect(blogPanel).toBeVisible();
  await blogPanel.evaluate((element) => {
    element.scrollTop = 0;
  });

  await blogPanel.hover({ position: { x: 320, y: 120 } });
  await page.mouse.wheel(0, -320);

  await expect(page).toHaveURL(/\/$/);
});

test("Blog restores its scroll position after visiting another panel", async ({ page }) => {
  await page.goto("/blog");

  const blogPanel = page.locator("[data-panel-layer='blog']");
  await expect(blogPanel).toBeVisible();
  await expect
    .poll(() =>
      blogPanel.evaluate((element) => element.scrollHeight - element.clientHeight),
    )
    .toBeGreaterThan(900);
  await blogPanel.evaluate((element) => {
    element.scrollTop = 900;
    element.dispatchEvent(new Event("scroll"));
  });

  await page.getByRole("link", { name: "Author", exact: true }).click();
  await expect(page).toHaveURL(/\/author$/);
  await page.getByRole("link", { name: "Blog", exact: true }).click();
  await expect(page).toHaveURL(/\/blog$/);

  await expect
    .poll(() => blogPanel.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(800);
});
