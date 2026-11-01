import gsap from "gsap";
import { afterEach, describe, expect, it, vi } from "vitest";

const presets = vi.hoisted(() => ({
  playBladeAccent: vi.fn(() => null),
  playFocusPush: vi.fn(),
  playScrim: vi.fn(),
}));

vi.mock("@/motion/route-transition-presets", () => presets);

function mountShell(stageMarkup: string) {
  document.body.innerHTML = `
    <div data-route-shell>
      <div data-transition-scrim></div>
      <div data-transition-blade></div>
      <div data-route-stage>${stageMarkup}</div>
    </div>
  `;
}

describe("route transition orchestrator", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("plays the soft return on the panel being returned to", async () => {
    presets.playFocusPush.mockImplementation(() => gsap.timeline());
    presets.playScrim.mockImplementation(() => gsap.timeline());
    // The article surface is already unmounted when the return transition starts.
    mountShell(`<section data-panel-active="true" data-testid="blog-panel"></section>`);
    const { playRouteTransition } = await import("@/composables/useRouteTransitionOrchestrator");

    await playRouteTransition({ kind: "postToPage" });

    expect(presets.playFocusPush).toHaveBeenCalledTimes(1);
    const [target, options] = presets.playFocusPush.mock.calls[0] as unknown as [
      HTMLElement,
      { preset: string },
    ];
    expect(target.dataset.testid).toBe("blog-panel");
    expect(options.preset).toBe("softReturn");
  });

  it("still focuses the article surface when opening a post", async () => {
    presets.playFocusPush.mockImplementation(() => gsap.timeline());
    presets.playScrim.mockImplementation(() => gsap.timeline());
    mountShell(`<article data-post-surface data-testid="post"></article>`);
    const { playRouteTransition } = await import("@/composables/useRouteTransitionOrchestrator");

    await playRouteTransition({ kind: "pageToPost" });

    const [target] = presets.playFocusPush.mock.calls[0] as unknown as [HTMLElement];
    expect(target.dataset.testid).toBe("post");
  });
});
