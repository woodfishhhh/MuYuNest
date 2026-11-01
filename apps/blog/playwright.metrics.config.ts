import { defineConfig, devices } from "@playwright/test";

// This suite writes synthetic metrics and must use an isolated local backend.
process.env.COUNTER_INTEGRATION = "1";
process.env.ANALYTICS_INTEGRATION = "1";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["visitor-count.spec.ts", "analytics-pwa.spec.ts"],
  outputDir: "../../output/metrics-e2e",
  workers: 1,
  fullyParallel: false,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:4183",
    httpCredentials: { username: "e2e", password: "e2e" },
    trace: "retain-on-failure",
  },
  projects: [{
    name: "desktop-chrome",
    use: {
      ...devices["Desktop Chrome"],
      channel: "chrome",
      // Exercise accepted browser events rather than the intentional bot filter.
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    },
  }],
});
