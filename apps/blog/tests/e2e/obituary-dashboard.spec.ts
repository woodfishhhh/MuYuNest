import { expect, test } from "@playwright/test";
import { dirname, resolve } from "node:path";

test("private dashboard shows installation counts and isolates a summary failure", async ({ page }, testInfo) => {
  const assets = resolve(dirname(testInfo.file), "../../../../server/analytics-dashboard");
  const origin = "http://dashboard.test";
  const counts = { weekly_active: 5, monthly_active: 9, cumulative_installs: 11 };
  let unavailable = false;
  await page.route(`${origin}/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/analytics/api/obituary/summary") {
      return route.fulfill(unavailable ? { status: 503 } : { json: {
        ...counts, as_of: "2026-11-19", daily_active: [{ date: "2026-11-18", count: null }, { date: "2026-11-19", count: 0 }],
        distributions: { version: {}, os: {}, language: {}, channel: { scoop: 4 } }, channel_reports: { scoop: 21 },
      }});
    }
    if (path === "/api/analytics/summary") return route.fulfill({ json: {
      totals: { pageviews: 1, visitors: 1, sessions: 1, bounceRate: 0, avgSessionSeconds: 1, activeVisitors30m: 1 },
      timeSeries: [], topPages: [], referrers: [], devices: [], browsers: [], operatingSystems: [], customEvents: [], webVitals: [], generatedAt: "2026-11-20",
    }});
    const file = path.slice("/analytics/".length) || "index.html";
    if (!["index.html", "dashboard.css", "dashboard.js"].includes(file)) return route.abort();
    return route.fulfill({ path: resolve(assets, file) });
  });
  await page.goto(`${origin}/analytics/`);
  await expect(page.locator("#obituary-week")).toHaveText("5");
  await expect(page.locator("#obituary-month")).toHaveText("9");
  await expect(page.locator("#obituary-total")).toHaveText("11");
  await expect(page.locator("#obituary-channel .rank-value")).toHaveText("4");
  await expect(page.locator("#obituary-version")).toHaveText("暂无数据");
  await expect(page.locator("#obituary-chart")).toBeVisible();
  unavailable = true;
  await page.getByRole("button", { name: "刷新" }).click();
  await expect(page.locator("#obituary-status")).toContainText("503");
  await expect(page.locator("#obituary-data")).toBeHidden();
  await expect(page.locator("#status")).toHaveText("统计范围：近 30 天");
});
