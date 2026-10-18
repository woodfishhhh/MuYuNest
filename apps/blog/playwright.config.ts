import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4174);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: `pnpm exec nuxt dev --host 127.0.0.1 --port ${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    url: baseURL,
  },
  projects: [
    {
      name: "desktop-chrome",
      testIgnore: "**/*.mobile.spec.ts",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "mobile-chrome",
      testMatch: "**/*.mobile.spec.ts",
      use: {
        ...devices["Pixel 7"],
        channel: "chrome",
        viewport: { height: 320, width: 390 },
      },
    },
  ],
});
