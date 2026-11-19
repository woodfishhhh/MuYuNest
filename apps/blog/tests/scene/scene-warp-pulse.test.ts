import { describe, expect, it } from "vite-plus/test";

import {
  resolveSceneWarpPulse,
  sampleSceneWarpPulse,
} from "@/components/scene/scene-warp-pulse";

describe("scene warp pulse", () => {
  it("jumps forward into an article and backs out when leaving it", () => {
    const enter = resolveSceneWarpPulse("blog", "post");
    const leave = resolveSceneWarpPulse("post", "blog");

    expect(enter?.direction).toBe(1);
    expect(leave?.direction).toBe(-1);
    expect(enter!.strength).toBeGreaterThan(leave!.strength);
    expect(resolveSceneWarpPulse("home", "post")?.direction).toBe(1);
    expect(resolveSceneWarpPulse("post", "friend")?.direction).toBe(-1);
  });

  it("follows the navigation order between panels", () => {
    expect(resolveSceneWarpPulse("home", "blog")?.direction).toBe(1);
    expect(resolveSceneWarpPulse("friend", "works")?.direction).toBe(-1);
    expect(resolveSceneWarpPulse("works", "author-page")?.direction).toBe(1);
  });

  it("travels farther for distant panels without exceeding an article jump", () => {
    const near = resolveSceneWarpPulse("home", "works");
    const far = resolveSceneWarpPulse("home", "friend");
    const article = resolveSceneWarpPulse("home", "post");

    expect(far!.strength).toBeGreaterThan(near!.strength);
    expect(far!.strength).toBeLessThan(article!.strength);
  });

  it("stays still for moves within a place or outside the scene", () => {
    expect(resolveSceneWarpPulse("blog", "blog")).toBeNull();
    expect(resolveSceneWarpPulse("post", "post")).toBeNull();
    expect(resolveSceneWarpPulse("author", "author-page")).toBeNull();
    expect(resolveSceneWarpPulse("author-page-root", "author")).toBeNull();
    expect(resolveSceneWarpPulse(null, "home")).toBeNull();
    expect(resolveSceneWarpPulse("home", "star-clusters-playground")).toBeNull();
  });

  it("rises quickly, peaks at its strength and settles back to zero", () => {
    const pulse = { direction: -1 as const, strength: 0.5, duration: 1 };
    const samples = Array.from({ length: 101 }, (_, step) => sampleSceneWarpPulse(pulse, step / 100));
    const peakIndex = samples.reduce((best, value, index) => (value < samples[best] ? index : best), 0);

    expect(sampleSceneWarpPulse(pulse, 0)).toBe(0);
    expect(sampleSceneWarpPulse(pulse, 1)).toBe(0);
    expect(sampleSceneWarpPulse(pulse, 2)).toBe(0);
    expect(Math.min(...samples)).toBeCloseTo(-0.5, 2);
    expect(peakIndex).toBeLessThan(35);
    expect(samples.every((value) => value <= 0 && value >= -0.5)).toBe(true);
  });
});
