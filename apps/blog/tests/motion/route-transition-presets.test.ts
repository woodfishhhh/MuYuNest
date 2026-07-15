import { describe, expect, it } from "vite-plus/test";

import { getTransitionPresetName } from "@/composables/useRouteTransitionOrchestrator";
import { getPresetVars, playFocusPush } from "@/motion/route-transition-presets";

describe("route transition presets", () => {
  it("uses low-motion config when reduced motion is enabled", () => {
    const vars = getPresetVars("focusPush", { reducedMotion: true });
    expect(vars.duration).toBeLessThanOrEqual(0.32);
    expect(vars.blur).toBe(0);
    expect(vars.scaleFrom).toBe(1);
    expect(vars.yFrom).toBeGreaterThanOrEqual(4);
  });

  it("uses cinematic config when reduced motion is disabled", () => {
    const vars = getPresetVars("focusPush", { reducedMotion: false });
    expect(vars.duration).toBeGreaterThanOrEqual(0.6);
    expect(vars.blur).toBeGreaterThan(0);
    expect(vars.scaleFrom).toBeLessThan(1);
    expect(vars.yFrom).toBeGreaterThan(10);
  });

  it("keeps soft return lighter than focus push", () => {
    const focus = getPresetVars("focusPush", { reducedMotion: false });
    const back = getPresetVars("softReturn", { reducedMotion: false });
    expect(back.duration).toBeLessThan(focus.duration);
    expect(back.blur).toBeLessThanOrEqual(focus.blur);
  });

  it("keeps direct panel switches off the expensive blur path", () => {
    expect(getTransitionPresetName("panelTransition")).toBe("panelShift");

    const panel = getPresetVars("panelShift", { reducedMotion: false });
    expect(panel.blur).toBe(0);
    expect(panel.duration).toBeLessThanOrEqual(0.5);
    expect(panel.scaleFrom).toBe(1);
    expect(panel.yFrom).toBe(0);
  });

  it("does not create a transformed compositor layer for panel switches", () => {
    const element = document.createElement("div");
    const tween = playFocusPush(element, { preset: "panelShift", reducedMotion: false });

    expect(element.style.filter).toBe("");
    expect(element.style.transform).toBe("");
    tween.kill();
  });
});
