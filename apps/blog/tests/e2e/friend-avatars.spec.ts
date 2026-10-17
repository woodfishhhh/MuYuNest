import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });
test("friend avatars recover locally, failed hosts show initials, and requested fonts apply", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1413, height: 871 });
  await page.route("https://www.maskviva.xyz/**", (route) => route.abort());
  await page.goto("/friend");
  const cards = page.getByTestId("friend-link-card");
  await expect(cards).toHaveCount(21);
  for (const name of ["江西财经大学计算机协会", "D-blog"]) {
    const card = cards.filter({ has: page.getByRole("heading", { name, exact: true }) });
    await card.scrollIntoViewIfNeeded();
    const img = card.locator("img");
    await expect(img).toHaveAttribute("src", /^\/imported-assets\//);
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  const offline = cards.filter({ has: page.getByRole("heading", { name: "maskviva", exact: true }) });
  await offline.scrollIntoViewIfNeeded();
  await expect(offline.getByTestId("friend-avatar-fallback")).toHaveText("MA");
  const family = await offline.locator("h3").evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/^Consolas/);
  expect(family).toContain("YouYuan");
  await page.screenshot({ animations: "disabled", path: info.outputPath("friends-fixed.png") });
});
