import type { Page } from "@playwright/test";

// Find a real raycast hit without depending on the number/order of configured poems.
export async function hoverCard(page: Page) {
  const viewport = page.viewportSize()!;
  const flight = page.locator("[data-home-flight]");
  for (let dy = 0; dy <= 65; dy += 8) {
    for (let dx = -24; dx <= 24; dx += 8) {
      const x = viewport.width / 2 + dx;
      const y = viewport.height * 0.512 + dy;
      await page.mouse.move(x, y);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      if ((await flight.getAttribute("class"))?.split(/\s+/).includes("cursor-grab")) return { x, y };
    }
  }
  throw new Error("No visible Home card accepted the pointer");
}
