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

// The home page is a scroll-driven film; jump into a chapter and wait for the scene to follow.
export async function scrollToFilmChapter(page: Page, chapter: string, local = 0.4) {
  await page.locator(`[data-film-chapter="${chapter}"]`).waitFor({ state: "attached" });
  await page.evaluate(({ chapter, local }) => {
    const section = document.querySelector<HTMLElement>(`[data-film-chapter="${chapter}"]`)!;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (section.offsetHeight - window.innerHeight) * local);
  }, { chapter, local });
  await page.locator(`[data-home-film-chapter="${chapter}"]`).waitFor();
}

// The opening frames the geometry off-centre; sweep for a pixel the raycast accepts.
export async function hoverGeometry(page: Page) {
  const viewport = page.viewportSize()!;
  const flight = page.locator("[data-home-flight]");
  for (let y = viewport.height * 0.25; y <= viewport.height * 0.7; y += 24) {
    for (let x = viewport.width * 0.5; x <= viewport.width * 0.95; x += 24) {
      await page.mouse.move(x, y);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      if ((await flight.getAttribute("class"))?.split(/\s+/).includes("cursor-pointer")) return { x, y };
    }
  }
  throw new Error("The opening geometry never accepted the pointer");
}
