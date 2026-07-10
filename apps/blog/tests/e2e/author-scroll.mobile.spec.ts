import { expect, test } from "@playwright/test";

test("a swipe inside scrollable Author content does not change slides", async ({ page }) => {
  await page.goto("/author");

  const aboutButton = page.getByRole("button", { name: "About", exact: true });
  await aboutButton.click();
  await expect(aboutButton).toHaveAttribute("aria-current", "true");
  await page.waitForTimeout(1_000);

  const aboutPanel = page.locator(".author-screen__panel--about");
  await expect(aboutPanel).toBeVisible();
  await expect
    .poll(() =>
      aboutPanel.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      })),
    )
    .toEqual(expect.objectContaining({ clientHeight: expect.any(Number), scrollHeight: expect.any(Number) }));

  const canScroll = await aboutPanel.evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  );
  expect(canScroll).toBe(true);

  await aboutPanel.evaluate((element) => {
    element.scrollTop = 0;
    const start = new Touch({
      clientX: 160,
      clientY: 360,
      identifier: 1,
      target: element,
    });
    const end = new Touch({
      clientX: 160,
      clientY: 240,
      identifier: 1,
      target: element,
    });

    element.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [start],
      }),
    );
    element.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        changedTouches: [end],
      }),
    );
  });

  await expect(aboutButton).toHaveAttribute("aria-current", "true");
});
