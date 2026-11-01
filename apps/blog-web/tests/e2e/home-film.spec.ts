import { expect, test } from "@playwright/test";

import { scrollToFilmChapter } from "./home-card-helpers";

test.use({ viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: "reduce" } });

test("old author links land on the film's roles chapter", async ({ page }) => {
  for (const path of ["/author", "/author/2", "/3"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/#about$/);
    await expect(page.locator("[data-home-film-chapter='roles']")).toBeAttached();
  }

  // Only /1 – /4 were author slides; other numbers are still missing pages.
  await page.goto("/9");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("the film plays forward and back as a function of scroll", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("home-film")).toBeAttached();
  await expect(page.getByRole("link", { name: "Author" })).toHaveCount(0);

  const chapterProgress = (chapter: string) =>
    page.locator(`[data-film-chapter="${chapter}"]`).evaluate((element) => Number(getComputedStyle(element).getPropertyValue("--t")));

  let timeOnTheWayDown = "";
  for (const chapter of ["roles", "time", "tools", "poem", "collect", "end"]) {
    await scrollToFilmChapter(page, chapter, 0.5);
    await expect.poll(() => chapterProgress(chapter)).toBeCloseTo(0.5, 1);
    if (chapter === "time") timeOnTheWayDown = (await page.locator(".film-time__value span").textContent()) ?? "";
  }

  expect(timeOnTheWayDown).not.toBe("0.0");
  await scrollToFilmChapter(page, "time", 0.5);
  await expect(page.locator(".film-time__value span")).toHaveText(timeOnTheWayDown);
  await scrollToFilmChapter(page, "opening", 0);
  await expect.poll(() => chapterProgress("opening")).toBe(0);
  await expect.poll(() => chapterProgress("roles")).toBe(0);

  await expect(page.getByRole("link", { name: /WORKS/ })).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("mobile toolbox retains visible icons when labels are hidden", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await scrollToFilmChapter(page, "tools", 0.5);
  const icons = page.locator(".film-tools__item img");
  expect(await icons.count()).toBeGreaterThan(0);
  const widths = await icons.evaluateAll((images) => images.map((image) => image.getBoundingClientRect().width));
  expect(widths.every((width) => width > 10)).toBe(true);
});
