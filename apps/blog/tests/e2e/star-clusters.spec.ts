import { expect, test } from "@playwright/test";
import selectedPlayground from "../../src/content/star-playground.json" with { type: "json" };

const evidence = "../../experiments/star-motion-playground/evidence";
const route = "/playground/star-clusters";

test("desktop modes retain independent parameters, export and restore them", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(route);
  await expect(page.getByRole("heading", { name: "射线模式", exact: true })).toBeVisible();
  const canvas = page.locator("canvas.cluster-canvas");
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: "复制这组参数" }).click();
  expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))).toEqual(selectedPlayground);
  const preview = await page.locator(".lab-preview").boundingBox();
  const panel = await page.locator(".lab-panel").boundingBox();
  expect(panel!.width).toBe(400);
  expect(preview!.x + preview!.width).toBeLessThanOrEqual(panel!.x);
  await page.getByRole("slider", { name: "射线数量", exact: true }).press("End");
  await expect(page.getByRole("slider", { name: "射线数量", exact: true })).toHaveValue("36");
  await page.getByRole("spinbutton", { name: "射线数量数值", exact: true }).fill("20");
  await page.getByRole("spinbutton", { name: "射线数量数值", exact: true }).press("Tab");
  await expect(page.getByRole("slider", { name: "射线数量", exact: true })).toHaveValue("20");
  await page.getByRole("button", { name: "对照原版", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-motion-mode", "reference");
  await page.getByRole("spinbutton", { name: "流动速度数值", exact: true }).fill("6.5");
  await page.getByRole("spinbutton", { name: "流动速度数值", exact: true }).press("Tab");
  await expect(canvas).toHaveAttribute("data-motion-mode", "rays");
  await page.getByRole("button", { name: /彗星模式/ }).click();
  await expect(canvas).toHaveAttribute("data-motion-mode", "comet");
  await page.getByRole("spinbutton", { name: "尾迹长度数值", exact: true }).fill("2.4");
  await page.getByRole("spinbutton", { name: "尾迹长度数值", exact: true }).press("Tab");
  await page.getByRole("button", { name: /射线模式/ }).first().click();
  await expect(page.getByRole("slider", { name: "射线数量", exact: true })).toHaveValue("20");
  await expect(page.getByRole("slider", { name: "流动速度", exact: true })).toHaveValue("6.5");
  await page.getByRole("button", { name: /彗星模式/ }).first().click();
  await expect(page.getByRole("slider", { name: "尾迹长度", exact: true })).toHaveValue("2.4");
  await page.getByLabel("中心几何体", { exact: true }).selectOption("none");
  await page.getByRole("button", { name: "复制这组参数" }).click();
  await expect(page.getByRole("status")).toContainText("已复制");
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(copied).toMatchObject({ version: 3, mode: "comet", geometry: "none", settings: { trail: 2.4 }, modes: { rays: { count: 20, flow: 6.5 } } });
  await page.reload();
  await expect(canvas).toHaveAttribute("data-motion-mode", "comet");
  await expect(page.getByRole("slider", { name: "尾迹长度", exact: true })).toHaveValue("2.4");
  await page.getByRole("button", { name: "漫游星空", exact: true }).click();
  await expect(page.locator(".star-lab")).toHaveAttribute("data-cluster-mode", "roam");
  await page.getByRole("button", { name: "重新播放", exact: true }).click();
  await expect(page.locator(".star-lab")).toHaveAttribute("data-cluster-mode", "collect");
  await page.getByRole("button", { name: "恢复默认", exact: true }).click();
  await expect(page.getByRole("slider", { name: "尾迹长度", exact: true })).toHaveValue("2.7");
  await page.getByRole("button", { name: /射线模式/ }).first().click();
  await expect(page.getByRole("slider", { name: "流动速度", exact: true })).toHaveValue("6.5");
  expect(errors).toEqual([]);
});

test("all motion presets render, pause freezes the canvas, and daytime cards remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 1651, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(route);
  const canvas = page.locator("canvas.cluster-canvas");
  const modes = [
    { name: "射线模式", id: "rays", presets: ["舒展星线", "宽幅爆发", "旋转星束"] },
    { name: "彗星模式", id: "comet", presets: ["远行彗星", "彗星群", "长尾掠影"] },
    { name: "星团掉落", id: "fall", presets: ["迎面星团", "密集冲刺", "缓慢靠近"] },
  ];
  for (const mode of modes) {
    await page.locator(".motion-modes").getByRole("button", { name: new RegExp(mode.name) }).click();
    await expect(canvas).toHaveAttribute("data-motion-mode", mode.id);
    for (const preset of mode.presets) {
      await page.getByRole("button", { name: preset, exact: true }).click();
      await expect(page.getByRole("button", { name: preset, exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${evidence}/${mode.id}-${preset}.png` });
    }
  }
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const frozen = await canvas.screenshot();
  await page.waitForTimeout(200);
  expect((await canvas.screenshot()).equals(frozen)).toBe(true);
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.getByRole("button", { name: "切到白天", exact: true }).click();
  await page.getByLabel("中心几何体", { exact: true }).selectOption("mobius");
  await page.getByLabel("一起看看诗卡", { exact: true }).check();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${evidence}/day-cards.png` });
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const width of [320, 390]) {
  test(`mobile ${width}px supports all modes and a usable settings drawer`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(route);
    const drawer = page.getByRole("button", { name: /调节参数/ });
    await expect(drawer).toHaveAttribute("aria-expanded", "false");
    for (const name of ["彗星模式", "星团掉落", "射线模式"]) {
      await page.locator(".motion-modes").getByRole("button", { name: new RegExp(name) }).click();
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${evidence}/mobile-${width}.png` });
    await drawer.click();
    await expect(drawer).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("spinbutton", { name: "流动速度数值", exact: true }).fill("99");
    await page.getByRole("spinbutton", { name: "流动速度数值", exact: true }).press("Tab");
    await expect(page.getByRole("slider", { name: "流动速度", exact: true })).toHaveValue("8");
    await page.getByRole("slider", { name: "射线数量", exact: true }).press("End");
    await expect(page.getByRole("slider", { name: "射线数量", exact: true })).toHaveValue("36");
    await page.screenshot({ path: `${evidence}/mobile-${width}-controls.png` });
    await drawer.click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const modeButtons = await page.locator(".motion-modes button").all();
    for (const button of modeButtons) {
      const box = await button.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  });
}

test("saved v2 parameters migrate and reduced motion stays static", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("woodfish-star-lines-playground-v2", JSON.stringify({ version: 2, seed: 123, settings: { bunches: 7, spread: 0.8, flow: 1.4 }, theme: "day", geometry: "mobius" })));
  await page.goto(route);
  await expect(page.getByRole("slider", { name: "每条线的星簇", exact: true })).toHaveValue("7");
  await expect(page.locator(".star-lab")).toHaveClass(/is-day/);
  const canvas = page.locator("canvas.cluster-canvas");
  await page.waitForTimeout(400);
  const frozen = await canvas.screenshot();
  await page.waitForTimeout(200);
  expect((await canvas.screenshot()).equals(frozen)).toBe(true);
  await page.locator(".motion-modes").getByRole("button", { name: /彗星模式/ }).click();
  await expect(canvas).toHaveAttribute("data-motion-mode", "comet");
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const comet = await canvas.screenshot({ path: `${evidence}/reduced-comet-before.png` });
  expect(comet.equals(frozen)).toBe(false);
  await page.waitForTimeout(200);
  expect((await canvas.screenshot({ path: `${evidence}/reduced-comet-after.png` })).equals(comet)).toBe(true);
});
