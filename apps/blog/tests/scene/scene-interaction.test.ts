import { describe, expect, it } from "vite-plus/test";

import {
  SCENE_HOVER_RAYCAST_INTERVAL,
  resolveScenePointerDownAction,
  supportsWorksOrbitViewport,
  shouldRunSceneHoverRaycast,
  shouldRaycastSceneGeometry,
} from "@/components/scene/scene-interaction";

describe("scene interaction routing", () => {
  it("matches the Works panel desktop breakpoint", () => {
    expect(supportsWorksOrbitViewport(1023)).toBe(false);
    expect(supportsWorksOrbitViewport(1024)).toBe(true);
  });

  it("does not route desktop works clicks to geometry focus", () => {
    expect(
      resolveScenePointerDownAction({
        mode: "works",
        worksViewMode: "orbit",
        isFocusing: false,
        isMobile: false,
        hasWorksHit: false,
        hasGeometryHit: true,
      }),
    ).toBe("none");

    expect(shouldRaycastSceneGeometry("works", "orbit", false, false)).toBe(false);
  });

  it("routes desktop works card hits to grab-card only", () => {
    expect(
      resolveScenePointerDownAction({
        mode: "works",
        worksViewMode: "orbit",
        isFocusing: false,
        isMobile: false,
        hasWorksHit: true,
        hasGeometryHit: true,
      }),
    ).toBe("grab-card");
  });

  it("keeps geometry focus available only on home", () => {
    expect(
      resolveScenePointerDownAction({
        mode: "home",
        worksViewMode: "orbit",
        isFocusing: false,
        isMobile: false,
        hasWorksHit: false,
        hasGeometryHit: true,
      }),
    ).toBe("focus-geometry");

    expect(shouldRaycastSceneGeometry("home", "orbit", false, false)).toBe(true);
  });

  it("blocks geometry focus and hover raycast on every non-home panel", () => {
    for (const mode of ["blog", "author", "friend", "reading"] as const) {
      expect(
        resolveScenePointerDownAction({
          mode,
          worksViewMode: "orbit",
          isFocusing: false,
          isMobile: false,
          hasWorksHit: false,
          hasGeometryHit: true,
        }),
      ).toBe("none");

      expect(shouldRaycastSceneGeometry(mode, "orbit", false, false)).toBe(false);
    }
  });

  it("disables orbit-card routing when desktop works is in Case mode", () => {
    expect(
      resolveScenePointerDownAction({
        mode: "works",
        worksViewMode: "case",
        isFocusing: false,
        isMobile: false,
        hasWorksHit: true,
        hasGeometryHit: true,
      }),
    ).toBe("none");

    expect(shouldRaycastSceneGeometry("works", "case", false, false)).toBe(false);
  });

  it("limits continuous geometry hover raycasts to 30Hz", () => {
    expect(shouldRunSceneHoverRaycast(0, Number.NEGATIVE_INFINITY)).toBe(true);
    expect(shouldRunSceneHoverRaycast(1, 1)).toBe(false);
    expect(shouldRunSceneHoverRaycast(1 + SCENE_HOVER_RAYCAST_INTERVAL / 2, 1)).toBe(false);
    expect(shouldRunSceneHoverRaycast(1 + SCENE_HOVER_RAYCAST_INTERVAL, 1)).toBe(true);
  });
});
