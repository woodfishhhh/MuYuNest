import { expect, test } from "@playwright/test";

const evidence = "../../experiments/wodniack-cards/evidence/photo-cards";

test("photo descriptions, WebP assets and the alternating gallery render correctly", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/playground/home-cards");
  await expect(page.locator("figure[data-card-type=text]")).toHaveCount(15);
  await expect(page.locator("figure[data-card-type=image]")).toHaveCount(16);
  const types = await page.locator("figure").evaluateAll(figures => figures.map(figure => figure.getAttribute("data-card-type")));
  types.slice(0, 30).forEach((type, i) => expect(type).toBe(i % 2 ? "image" : "text"));
  const first = page.locator('[data-card-id="photo-lens-01"]');
  await expect(first.locator("canvas")).toHaveCount(1);
  await expect(first.locator("figcaption")).toHaveText("我");
  await page.screenshot({ path: `${evidence}/gallery.png` });
  for (let i = 1; i <= 15; i++) {
    const photo = page.locator(`[data-card-id="photo-lens-${String(i).padStart(2, "0")}"]`);
    await photo.scrollIntoViewIfNeeded(); await expect(photo.locator("canvas")).toHaveCount(1);
    const description = i <= 6 ? ["我", "生日派对", "niko", "爱情公寓", "橘子洲头", "我的衣服"][i - 1] : `我的镜头下${i - 6}`;
    await expect(photo.locator("figcaption")).toHaveText(description);
  }
  const cs = page.locator('[data-card-id="photo-love-cs"]');
  await cs.scrollIntoViewIfNeeded(); await expect(cs.locator("canvas")).toHaveCount(1);
  await expect(cs.locator("figcaption")).toHaveText("love CS");
  await cs.screenshot({ path: `${evidence}/love-cs.png` });
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Home decodes only its first photo and periodically drops a solid star", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const photos = new Set<string>();
  page.on("request", request => {
    if (request.resourceType() === "image" && /\/(?:photo-\d{2}|love-cs)[.-]/.test(request.url())) photos.add(request.url());
  });
  await page.goto("/");
  const flight = page.locator("[data-home-flight]");
  await expect(flight).toHaveAttribute("data-home-flight-ready", "true");
  await expect.poll(() => photos.size).toBe(1);
  await page.waitForTimeout(300);
  expect(photos.size).toBe(1);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(flight).toHaveAttribute("data-home-falling-star", "true", { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${evidence}/falling-star.png` });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${evidence}/falling-star-near.png` });
  await page.getByRole("switch", { name: "拾光模式" }).click();
  await expect(flight).toHaveAttribute("data-home-flight", "inactive");
  await expect(flight).toHaveAttribute("data-home-falling-star", "false");
});
