import { hoverCard } from "./home-card-helpers";
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, contextOptions: { reducedMotion: "reduce" } });

test("touch dragging a Home card does not swipe to the Author panel", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem("vuecubeblog-theme", "day"); Math.random = () => 0.5; });
  await page.goto("/");
  const flight = page.locator("[data-home-flight]");
  await expect(flight).toHaveAttribute("data-home-flight", "inactive");
  const modeToggle = page.getByRole("switch", { name: "拾光模式" });
  await expect(modeToggle).toBeVisible();
  await expect(modeToggle).toHaveAttribute("aria-checked", "false");
  const toggleBounds = await modeToggle.boundingBox();
  expect(toggleBounds!.x).toBeGreaterThan(195);
  expect(toggleBounds!.y).toBeGreaterThan(750);
  await modeToggle.tap();
  await expect(modeToggle).toHaveAttribute("aria-checked", "true");
  await expect(flight).toHaveAttribute("data-home-flight-ready", "true");
  await expect(page.locator("[data-home-flight-rays]")).toHaveCount(0);
  await page.waitForTimeout(100);
  const client = await context.newCDPSession(page);
  const { x, y } = await hoverCard(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await expect(flight).toHaveAttribute("data-home-card-dragging", "true");
  await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 60, y: y - 150 }] });
  await page.waitForTimeout(200);
  await expect(page).toHaveURL(/\/$/);
  await expect(flight).toHaveAttribute("data-home-flight", "active");
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(flight).toHaveAttribute("data-home-card-dragging", "false");
  await modeToggle.tap();
  await expect(flight).toHaveAttribute("data-home-flight", "inactive");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(errors).toEqual([]);
});
