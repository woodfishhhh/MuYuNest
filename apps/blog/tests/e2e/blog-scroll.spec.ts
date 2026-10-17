import { expect, test } from "@playwright/test";

test("scrolling up at the top of Blog stays in the knowledge base", async ({ page }) => {
  await page.goto("/blog");
  const main = page.locator(".docs-main");
  await expect(main).toBeVisible();
  await main.hover({ position: { x: 320, y: 120 } });
  await page.mouse.wheel(0, -320);
  await expect(page).toHaveURL(/\/blog\/?$/);
});

test("Blog restores scroll after searching and going back", async ({ page }) => {
  await page.goto("/blog?topic=languages&series=go-basics");
  const main = page.locator(".docs-main");
  await expect(page.locator(".docs-article-row").first()).toBeVisible();
  await main.evaluate((el) => {
    el.scrollTop = 700;
    el.dispatchEvent(new Event("scroll"));
  });
  const before = await main.evaluate((el) => el.scrollTop);
  await page.locator(".docs-header-search input").fill("channel");
  await page.locator(".docs-header-search button").click();
  await expect(page).toHaveURL(/q=channel/);
  await page.goBack();
  await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeCloseTo(before, -1);
});

test("a cached Author panel does not block Friend wheel scrolling", async ({ page }) => {
  await page.goto("/author");
  await expect(page.locator("[data-testid='author-panel-root']")).toBeVisible();

  await page.getByRole("link", { name: "Friend", exact: true }).click();
  await expect(page).toHaveURL(/\/friend$/);

  const friendPanel = page.locator(".friend-links-pane");
  await expect(friendPanel).toBeVisible();
  await expect
    .poll(() => friendPanel.evaluate((element) => element.scrollHeight - element.clientHeight))
    .toBeGreaterThan(200);

  await friendPanel.hover({ position: { x: 320, y: 180 } });
  await page.mouse.wheel(0, 480);

  await expect.poll(() => friendPanel.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
});

test("standalone pages keep native document scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/playground/magnetic-pointer");
  await expect(page.locator("[data-testid='magnetic-pointer-playground']")).toBeVisible();
  for (const name of ["四角锁定", "雾面玻璃", "精密线框", "反相墨块"]) {
    await page.getByRole("radio", { name: new RegExp(name) }).click();
    const documentGeometry = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      opacity: getComputedStyle(document.documentElement).opacity,
      width: document.documentElement.getBoundingClientRect().width,
    }));
    expect(documentGeometry.opacity).toBe("1");
    expect(documentGeometry.width).toBe(documentGeometry.innerWidth);
  }
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight))
    .toBeGreaterThan(300);

  await page.mouse.move(380, 680);
  await page.mouse.wheel(0, 480);

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});

test("corner pointer playground keeps every study full-width and selectable", async ({ page }) => {
  await page.setViewportSize({ width: 1327, height: 1032 });
  await page.goto("/playground/magnetic-pointer-02");
  await expect(page.locator("[data-testid='magnetic-pointer-playground-02']")).toBeVisible();

  for (const [name, style] of [
    ["基准四角", "corners"],
    ["极细角标", "corners-hairline"],
    ["坐标刻度", "corners-axis"],
    ["信号切角", "corners-contrast"],
  ] as const) {
    await page.getByRole("radio", { name: new RegExp(name) }).click();
    const documentGeometry = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      opacity: getComputedStyle(document.documentElement).opacity,
      style: document.documentElement.dataset.magneticPointerStyle,
      width: document.documentElement.getBoundingClientRect().width,
    }));
    expect(documentGeometry.opacity).toBe("1");
    expect(documentGeometry.style).toBe(style);
    expect(documentGeometry.width).toBe(documentGeometry.innerWidth);
  }
});
