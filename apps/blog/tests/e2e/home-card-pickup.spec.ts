import { expect, test } from "@playwright/test";
import { hoverCard } from "./home-card-helpers";

test("a held card automatically turns over without another pointer move", async ({ page }) => {
  await page.setViewportSize({ width: 1651, height: 871 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("vuecubeblog-theme", "night");
    Math.random = () => 0.3;
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const flight = page.locator("[data-home-flight]");
  await expect(flight).toHaveAttribute("data-home-flight-ready", "true");
  await page.evaluate(() => document.fonts.ready);
  await hoverCard(page);
  const canvas = page.locator("[data-scene-layer] canvas");
  await page.mouse.down();
  await expect(flight).toHaveAttribute("data-home-card-dragging", "true");
  const start = await canvas.screenshot({ path: "../../experiments/smooth-transitions/evidence/pickup-start.png" });
  await page.waitForTimeout(220);
  const middle = await canvas.screenshot({ path: "../../experiments/smooth-transitions/evidence/pickup-middle.png" });
  await page.waitForTimeout(900);
  const settled = await canvas.screenshot({ path: "../../experiments/smooth-transitions/evidence/pickup-settled.png" });
  expect(start.equals(middle)).toBe(false);
  expect(middle.equals(settled)).toBe(false);
  await expect(flight).toHaveAttribute("data-home-card-dragging", "true");
  await page.mouse.up();
  await expect(flight).toHaveAttribute("data-home-card-dragging", "false");
  expect(errors).toEqual([]);
});
