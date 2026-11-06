import { describe, expect, it } from "vite-plus/test";

import {
  CALM_SCENE_FRAME_INTERVAL,
  createAdaptivePixelRatio,
  getScenePixelRatioCap,
  shouldSkipSceneFrame,
  type AdaptivePixelRatio,
} from "@/components/scene/scene-frame-budget";

type FrameModel = (pixelRatio: number) => number;

/** Fill-rate bound: frame time grows with the pixel count (ratio squared). */
const gpuBound = (secondsAt1x: number): FrameModel => (ratio) => secondsAt1x * ratio * ratio;
/** A browser that only delivers 30 frames per second (Low Power Mode, Energy Saver). */
const refreshCapped: FrameModel = () => 1 / 30;
/** Main-thread bound: resolution barely changes the frame time. */
const cpuBound: FrameModel = (ratio) => 0.036 - 0.0015 * (2 - ratio);
/** GPU bound on a fixed 60Hz display: frames snap to whole vsync intervals. */
const vsyncQuantized: FrameModel = (ratio) => Math.ceil((0.0055 * ratio * ratio) / (1 / 60)) / 60;
const smooth: FrameModel = () => 1 / 60;

/** Runs the controller for `seconds` of frames whose time depends on its current ratio. */
function run(controller: AdaptivePixelRatio, model: FrameModel, seconds: number) {
  const changes: number[] = [];
  let elapsed = 0;
  while (elapsed < seconds) {
    const interval = model(controller.value);
    elapsed += interval;
    const next = controller.sample(interval);
    if (next !== null) changes.push(next);
  }
  return changes;
}

describe("scene pixel ratio cap", () => {
  it("never renders the backdrop above 2x", () => {
    expect(getScenePixelRatioCap(3)).toBe(2);
    expect(getScenePixelRatioCap(1.5)).toBe(1.5);
    expect(getScenePixelRatioCap(0.9)).toBe(0.9);
    expect(getScenePixelRatioCap(Number.NaN)).toBe(1);
  });
});

describe("adaptive pixel ratio", () => {
  it("keeps full resolution while frames stay smooth", () => {
    const controller = createAdaptivePixelRatio(2);

    expect(run(controller, smooth, 20)).toEqual([]);
    expect(controller.value).toBe(2);
  });

  it("lowers resolution on a fill-rate bound GPU until frames recover", () => {
    const controller = createAdaptivePixelRatio(2);

    // 50ms at 2x, 19.5ms at 1.25x: no longer slow, so it stops there.
    expect(run(controller, gpuBound(0.0125), 30)).toEqual([1.75, 1.5, 1.25]);
    expect(controller.value).toBe(1.25);
  });

  it("never goes below 1x, even on a GPU that stays slow", () => {
    const controller = createAdaptivePixelRatio(2);

    expect(run(controller, gpuBound(0.0625), 90)).toEqual([1.75, 1.5, 1.25, 1]);
    expect(controller.value).toBe(1);
  });

  it("keeps full resolution when the browser caps animation at 30fps", () => {
    const controller = createAdaptivePixelRatio(2);

    // Fewer pixels do not shorten capped frames, so the trial step is undone.
    expect(run(controller, refreshCapped, 10)).toEqual([1.75, 1.5, 2]);
    expect(run(controller, refreshCapped, 120)).toEqual([]);
    expect(controller.value).toBe(2);
  });

  it("keeps full resolution when the main thread is the bottleneck", () => {
    const controller = createAdaptivePixelRatio(2);

    run(controller, cpuBound, 10);
    expect(run(controller, cpuBound, 60)).toEqual([]);
    expect(controller.value).toBe(2);
  });

  it("looks past a vsync step that hides the first improvement", () => {
    const controller = createAdaptivePixelRatio(2);

    run(controller, vsyncQuantized, 60);
    // 1.75x still misses the 60Hz deadline; 1.5x makes it.
    expect(controller.value).toBe(1.5);
  });

  it("ignores a single slow window such as a shader compile hitch", () => {
    const controller = createAdaptivePixelRatio(2);

    run(controller, gpuBound(0.0125), 0.8);
    run(controller, smooth, 0.8);
    run(controller, gpuBound(0.0125), 0.8);

    expect(controller.value).toBe(2);
  });

  it("ignores paused frames like background tabs", () => {
    const controller = createAdaptivePixelRatio(2);

    for (let frame = 0; frame < 400; frame++) {
      expect(controller.sample(2)).toBeNull();
      expect(controller.sample(0)).toBeNull();
    }
    expect(controller.value).toBe(2);
  });

  it("adapts within seconds on a struggling device, not after a fixed frame count", () => {
    const controller = createAdaptivePixelRatio(2);
    let elapsed = 0;
    let firstChangeAt: number | null = null;
    const model = gpuBound(0.0208); // 12fps at 2x
    while (elapsed < 5 && firstChangeAt === null) {
      const interval = model(controller.value);
      elapsed += interval;
      if (controller.sample(interval) !== null) firstChangeAt = elapsed;
    }

    expect(firstChangeAt).not.toBeNull();
    expect(firstChangeAt!).toBeLessThan(2);
  });

  it("restores resolution only after a long smooth stretch", () => {
    const controller = createAdaptivePixelRatio(2);
    run(controller, gpuBound(0.0125), 30);
    expect(controller.value).toBe(1.25);

    // Eight smooth 0.75s windows are required; a partial window may carry over.
    expect(run(controller, smooth, 5)).toEqual([]);
    expect(run(controller, smooth, 2.5)).toEqual([1.5]);
  });

  it("settles instead of oscillating between two resolutions", () => {
    const controller = createAdaptivePixelRatio(2);
    const threshold: FrameModel = (ratio) => (ratio > 1.75 ? 1 / 30 : 1 / 60);

    expect(run(controller, threshold, 30)).toEqual([1.75, 2, 1.75]);
    expect(run(controller, threshold, 60)).toEqual([]);
    expect(controller.value).toBe(1.75);
  });

  it("adapts again after a context change such as switching panels", () => {
    const controller = createAdaptivePixelRatio(2);
    const threshold: FrameModel = (ratio) => (ratio > 1.75 ? 1 / 30 : 1 / 60);
    run(controller, threshold, 30);

    controller.noteContextChange();

    expect(run(controller, smooth, 7)).toEqual([2]);
  });

  it("does not blame resolution when a panel switch interrupts a trial", () => {
    const controller = createAdaptivePixelRatio(2);
    // Two slow windows start a trial at 1.75x...
    run(controller, gpuBound(0.0125), 1.6);
    expect(controller.value).toBe(1.75);

    // ...then a heavier panel appears before the trial is judged.
    controller.noteContextChange();
    run(controller, gpuBound(0.02), 30);

    expect(controller.value).toBeLessThan(1.75);
  });

  it("stays put after learning that resolution does not help, across panels", () => {
    const controller = createAdaptivePixelRatio(2);
    run(controller, refreshCapped, 10);

    controller.noteContextChange();

    expect(run(controller, refreshCapped, 60)).toEqual([]);
    expect(controller.value).toBe(2);
  });

  it("starts over when the window moves to a screen with another density", () => {
    const controller = createAdaptivePixelRatio(2);
    run(controller, gpuBound(0.0625), 90);

    controller.setMax(2);
    expect(controller.value).toBe(1);

    controller.setMax(1.5);
    expect(controller.value).toBe(1.5);
    expect(run(controller, gpuBound(0.0625), 3)).toEqual([1.25]);
  });

  it("does not adapt on 1x screens", () => {
    const controller = createAdaptivePixelRatio(1);

    expect(run(controller, gpuBound(0.05), 30)).toEqual([]);
    expect(controller.value).toBe(1);
  });
});

describe("calm scene frame limiter", () => {
  it("renders every frame without a cap", () => {
    expect(shouldSkipSceneFrame(10.001, 10, 0)).toBe(false);
  });

  it("always renders the first frame", () => {
    expect(shouldSkipSceneFrame(10, null, CALM_SCENE_FRAME_INTERVAL)).toBe(false);
  });

  it("renders every other 60Hz frame at the calm cap", () => {
    const rendered: number[] = [];
    let last: number | null = null;
    for (let frame = 0; frame < 60; frame++) {
      const now = frame / 60;
      if (shouldSkipSceneFrame(now, last, CALM_SCENE_FRAME_INTERVAL)) continue;
      rendered.push(frame);
      last = now;
    }

    expect(rendered).toHaveLength(30);
  });

  it("keeps roughly 30fps on high refresh displays", () => {
    let rendered = 0;
    let last: number | null = null;
    for (let frame = 0; frame < 144; frame++) {
      const now = frame / 144;
      if (shouldSkipSceneFrame(now, last, CALM_SCENE_FRAME_INTERVAL)) continue;
      rendered += 1;
      last = now;
    }

    expect(rendered).toBeGreaterThanOrEqual(28);
    expect(rendered).toBeLessThanOrEqual(36);
  });
});
