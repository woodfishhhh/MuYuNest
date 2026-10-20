import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block", reducedMotion: "reduce" });
test.skip(!process.env.COUNTER_INTEGRATION, "Requires an isolated visitor-counter backend, never production data.");

test("simultaneous tabs and reloads count a browser only once", async ({ context, page, request }) => {
  const before = (await (await request.get("/api/visitor-count")).json()).total;
  const pages = [page, await context.newPage(), await context.newPage(), await context.newPage()];
  await Promise.all(pages.map(async tab => {
    await tab.goto("/");
    await expect(tab.getByTestId("visitor-count-badge")).toContainText(String(before + 1));
  }));
  const ids = await Promise.all(pages.map(tab => tab.evaluate(() => localStorage.getItem("vuecubeblog:visitor-id:v1"))));
  expect(new Set(ids).size).toBe(1);
  await Promise.all(pages.map(tab => tab.reload()));
  expect((await (await request.get("/api/visitor-count")).json()).total).toBe(before + 1);
});

test("migrating an old counted browser preserves the existing total", async ({ page, request }) => {
  const before = (await (await request.get("/api/visitor-count")).json()).total;
  await page.addInitScript(() => localStorage.setItem("vuecubeblog:visitor-counted:v1", "1"));
  const registration = page.waitForResponse(response => response.url().endsWith("/api/visitor-count/visit"));
  await page.goto("/");
  expect(await (await registration).json()).toEqual({ total: before, counted: false });
  await page.reload();
  await expect(page.getByTestId("visitor-count-badge")).toContainText(String(before));
});

test("the cookie preserves identity when local storage is cleared", async ({ page, request }) => {
  const before = (await (await request.get("/api/visitor-count")).json()).total;
  await page.goto("/");
  await expect(page.getByTestId("visitor-count-badge")).toContainText(String(before + 1));
  await page.evaluate(() => localStorage.clear());
  const registration = page.waitForResponse(response => response.url().endsWith("/api/visitor-count/visit"));
  await page.reload();
  expect(await (await registration).json()).toEqual({ total: before + 1, counted: false });
});

test("a lost registration response can be retried without counting twice", async ({ page, request }) => {
  const before = (await (await request.get("/api/visitor-count")).json()).total;
  let dropped = false;
  await page.route("**/api/visitor-count/visit", async route => {
    if (dropped) { await route.continue(); return; }
    dropped = true;
    await route.fetch(); // Commit the real registration, then lose the response.
    await route.abort();
  });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("vuecubeblog:visitor-id:v1"))).not.toBeNull();
  await expect.poll(async () => (await (await request.get("/api/visitor-count")).json()).total).toBe(before + 1);
  const id = await page.evaluate(() => localStorage.getItem("vuecubeblog:visitor-id:v1"));
  await page.reload();
  await expect(page.getByTestId("visitor-count-badge")).toContainText(String(before + 1));
  expect(await page.evaluate(() => localStorage.getItem("vuecubeblog:visitor-id:v1"))).toBe(id);
});
