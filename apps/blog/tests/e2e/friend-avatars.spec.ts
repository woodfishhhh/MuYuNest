import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });
for (const width of [1413, 390]) {
  test(`friend text is at least 16px at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 871 });
    await page.goto("/friend");
    const panel = page.getByTestId("friend-panel-root");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("friend-link-card")).toHaveCount(21);
    const smallText = await panel.evaluate((root) =>
      Array.from(root.querySelectorAll<HTMLElement>("*"))
        .filter(
          (el) =>
            el.getClientRects().length &&
            Array.from(el.childNodes).some((node) => node.nodeType === 3 && node.textContent?.trim()),
        )
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => ({ text: el.textContent?.slice(0, 40), size: getComputedStyle(el).fontSize })),
    );
    expect(smallText).toEqual([]);
    await expect(page.getByTestId("friend-application-site-name").first()).toHaveCSS("font-size", "16px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ animations: "disabled", path: info.outputPath(`friend-16px-${width}.png`) });
  });
}
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
