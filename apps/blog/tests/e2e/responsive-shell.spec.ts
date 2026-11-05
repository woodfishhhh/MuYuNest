import { expect, test } from "@playwright/test";

const transitionWidths = [767, 768, 1023, 1024] as const;

for (const width of transitionWidths) {
  test(`keeps the site shell consistent at ${width}px`, async ({ page }) => {
    const wide = width >= 1024;
    await page.setViewportSize({ height: 900, width });

    await page.goto("/works");
    await expect(page.getByTestId(wide ? "site-nav-wide" : "site-nav-compact")).toBeVisible();
    await expect(page.getByTestId(wide ? "site-nav-compact" : "site-nav-wide")).toBeHidden();
    await expect(page.getByTestId("works-view-toggle")).toBeVisible({ visible: wide });
    await expect(page.getByTestId("works-view-case")).toBeVisible({ visible: !wide });

    await page.goto("/author");
    const authorPanelWidth = await page
      .locator(".author-screen__panel")
      .first()
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(authorPanelWidth).toBeCloseTo(wide ? width / 2 : width, -1);

    await page.goto("/friend");
    await expect(page.getByTestId("friend-panel-application")).toBeVisible({ visible: wide });
    await expect(page.getByTestId("friend-mobile-drawer-toggle")).toBeVisible({ visible: !wide });

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
}

test(
  "suspends cached liquid-gl lenses after leaving a compact Works panel",
  async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/works");

    const lensTargets = page.locator(
      '[data-panel-layer="works"] [data-liquid-gl-target]',
    );
    await expect(lensTargets.first()).toBeVisible();

    await page.getByText("WOODFISH", { exact: true }).click();
    await expect(page).toHaveURL(/\/$/);

    const inactiveTargetMetrics = await lensTargets.evaluateAll((targets) =>
      targets.map((target) => {
        const bounds = target.getBoundingClientRect();
        return {
          display: getComputedStyle(target).display,
          height: bounds.height,
          width: bounds.width,
        };
      }),
    );

    expect(inactiveTargetMetrics.length).toBeGreaterThan(0);
    expect(inactiveTargetMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ display: "none", height: 0, width: 0 }),
      ]),
    );
    expect(inactiveTargetMetrics.every((target) => target.display === "none")).toBe(true);
  },
);
