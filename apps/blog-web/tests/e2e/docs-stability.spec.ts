import { expect, test } from "@playwright/test";
test.use({ serviceWorkers: "block" });

test("Linux-generated legacy URLs resolve to the same canonical articles", async ({ page }) => {
  for (const [alias, canonical] of [
    ["1-cc97fa54", "1-849fada0"],
    ["07-de757c2c", "07-7c60a570"],
    ["2-e25c70a2", "2-fab0b7c6"],
  ]) {
    await page.goto(`/posts/${alias}`);
    await expect(page).toHaveURL(new RegExp(`/posts/${canonical}$`));
    await expect(page.locator(`#article-title-${canonical}`)).toBeVisible();
  }
});

test("article changes preserve the shell and align the active marker", async ({ page }, info) => {
  await page.setViewportSize({ width: 1651, height: 871 });
  await page.goto("/posts/1-849fada0?topic=frontend&series=react-notes");
  await expect(page.locator(".docs-app")).toHaveAttribute("data-docs-motion", "idle");
  await page.evaluate(() => {
    const shell = document.querySelector(".docs-app")!;
    const sidebar = document.querySelector(".docs-sidebar")!;
    const main = document.querySelector(".docs-main")!;
    const trace = { stop: false, bad: [] as string[] };
    (window as any).__docsTrace = trace;
    function frame() {
      if (!shell.isConnected || document.querySelector(".docs-app") !== shell) trace.bad.push("shell replaced");
      if (document.querySelector(".docs-sidebar") !== sidebar) trace.bad.push("sidebar replaced");
      if (getComputedStyle(main).opacity !== "1" || getComputedStyle(main).visibility !== "visible")
        trace.bad.push("background hidden");
      if (getComputedStyle(sidebar).transform !== "none") trace.bad.push("sidebar entered again");
      if (!trace.stop) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  for (const slug of ["2-74508d71", "7-ebd3ff12", "1-849fada0"]) {
    await page.locator(`.docs-sidebar a[href^="/posts/${slug}?"]`).click();
    await expect(page.locator(`h1[id="article-title-${slug}"]`)).toBeVisible();
    await expect(page.locator(".docs-app")).toHaveAttribute("data-docs-motion", "idle");
    await expect
      .poll(() =>
        page.locator(".docs-sidebar .docs-tree").evaluate((el) => {
          const target = el.querySelector("a.is-active")!.getBoundingClientRect();
          const marker = el.querySelector(".docs-tree__active-marker")!.getBoundingClientRect();
          return Math.max(
            Math.abs(target.top - marker.top),
            Math.abs(target.left - marker.left),
            Math.abs(target.height - marker.height),
          );
        }),
      )
      .toBeLessThan(1.5);
  }
  expect(
    await page.evaluate(() => {
      const trace = (window as any).__docsTrace;
      trace.stop = true;
      return trace.bad;
    }),
  ).toEqual([]);
  await page.screenshot({ animations: "disabled", path: info.outputPath("stable-reader.png") });
});

test("YouYuan does not use corrupted synthesized bold and the scene dock stays visible", async ({ page }, info) => {
  await page.goto("/posts/07-7c60a570?topic=frontend&series=vue3");
  await expect(page.locator(".docs-app")).toHaveAttribute("data-docs-motion", "idle");
  for (const theme of ["day", "night"]) {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await page
        .getByTestId("site-nav")
        .getByRole("button", { name: /切换到/ })
        .click();
    await page.waitForFunction(() => !document.documentElement.style.getPropertyValue("--theme-switch-radius"));
    await expect(page.locator("h1")).toHaveCSS("font-synthesis-weight", "none");
    await expect(page.locator(".docs-sidebar a.is-active")).toHaveCSS("font-synthesis-weight", "none");
    await expect(page.locator("[data-scene-blog-dock]")).toBeVisible();
    await expect(page.getByTestId("site-nav")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await page.screenshot({ animations: "disabled", path: info.outputPath(`font-dock-${theme}.png`) });
  }
});
