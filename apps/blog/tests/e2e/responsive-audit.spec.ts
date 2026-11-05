import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

const auditWidths = [320, 375, 768, 1024, 1280, 1440, 1920, 2560] as const;
const auditRoutes = ["works", "author", "friend", "blog"] as const;
const routeReadyTestIds = {
  author: "author-panel-root",
  blog: "blog-editorial-layout",
  friend: "friend-panel-root",
  works: "works-view-case",
} as const;
const outputRoot = resolve(
  process.env.RESPONSIVE_AUDIT_OUTPUT ?? "test-results/responsive-audit",
);

interface AuditEntry {
  clippedText: string[];
  documentOverflow: number;
  route: (typeof auditRoutes)[number];
  screenshot: string;
  width: (typeof auditWidths)[number];
}

test("captures the standard responsive matrix without horizontal overflow", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(outputRoot, { recursive: true });
  const entries: AuditEntry[] = [];
  const runtimeErrors: string[] = [];

  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  for (const route of auditRoutes) {
    for (const [index, width] of auditWidths.entries()) {
      await page.setViewportSize({ height: 900, width });
      if (index === 0) {
        await page.goto(`/${route}`);
        await expect(page.getByTestId("site-nav-compact")).toBeAttached();
        await expect(page.getByTestId(routeReadyTestIds[route])).toBeVisible();
      }

      await page.waitForTimeout(180);
      const metrics = await page.evaluate(() => {
        const documentOverflow = Math.max(
          0,
          document.documentElement.scrollWidth - window.innerWidth,
          document.body.scrollWidth - window.innerWidth,
        );
        const clippedText = Array.from(
          document.querySelectorAll<HTMLElement>("h1, h2, h3, p, a, button"),
        )
          .filter((element) => {
            const style = getComputedStyle(element);
            const intentionallyTruncated =
              style.textOverflow === "ellipsis" || Number(style.webkitLineClamp) > 0;
            return (
              element.getBoundingClientRect().width > 0 &&
              element.scrollWidth - element.clientWidth > 1 &&
              !intentionallyTruncated &&
              ["clip", "hidden"].includes(style.overflowX)
            );
          })
          .map((element) => element.textContent?.trim().slice(0, 80) ?? "")
          .filter(Boolean);

        return { clippedText, documentOverflow };
      });
      const screenshot = resolve(outputRoot, `${route}-${width}.png`);
      await page.screenshot({ animations: "disabled", path: screenshot });
      entries.push({ ...metrics, route, screenshot, width });
      expect(metrics.documentOverflow, `${route} at ${width}px`).toBeLessThanOrEqual(1);
      expect(metrics.clippedText, `${route} at ${width}px`).toEqual([]);
    }
  }

  await writeFile(
    resolve(outputRoot, "report.json"),
    `${JSON.stringify({ entries, runtimeErrors }, null, 2)}\n`,
    "utf8",
  );
  expect(runtimeErrors).toEqual([]);
});
