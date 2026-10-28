// Keeps the full-screen WebGL backdrop inside the device's frame budget.
// Fill rate dominates this scene (MSAA + additive stars at up to 2x DPR), so
// resolution is the lever that actually recovers frames on weak GPUs.

export const SCENE_MAX_PIXEL_RATIO = 2;
// Slow backdrops (article pages) look identical at 30fps and halve GPU work.
export const CALM_SCENE_FRAME_INTERVAL = 1 / 30;
// Windows are measured in time, not frames, so a 15fps device adapts as fast
// as a 60fps one instead of waiting four times longer.
export const ADAPTIVE_SAMPLE_WINDOW_SECONDS = 0.75;

const MIN_PIXEL_RATIO = 1;
const PIXEL_RATIO_STEP = 0.25;
const MIN_WINDOW_FRAMES = 8;
// 0.75s at 240Hz is 180 frames; the cap only bounds the buffer.
const MAX_WINDOW_FRAMES = 256;
// Medians above ~45fps mean the current resolution may be too expensive.
const SLOW_FRAME_INTERVAL = 1 / 45;
// Resolution comes back only with sustained ~57fps headroom.
const FAST_FRAME_INTERVAL = 1 / 57;
// Background tabs, GC pauses and shader compiles are not a resolution problem.
const MAX_SAMPLED_FRAME_INTERVAL = 0.25;
const SLOW_WINDOWS_TO_DOWNGRADE = 2;
const FAST_WINDOWS_TO_UPGRADE = 8;
// A slow median alone cannot tell a fill-rate bound GPU from a browser that
// caps animation at 30fps (Low Power Mode, Energy Saver) or a busy main
// thread. Every downgrade is therefore a trial: it must shorten frames by 10%
// within two steps (two, because vsync can hide the first improvement), or
// the old resolution comes back for good.
const TRIAL_IMPROVEMENT = 0.9;
const TRIAL_MAX_STEPS = 2;
// After going down, up and down again the device has shown its limit.
const MAX_DIRECTION_CHANGES = 2;
// rAF timestamps jitter; without slack a 30fps cap drops to 20fps at 60Hz.
const FRAME_INTERVAL_TOLERANCE = 0.004;

export interface AdaptivePixelRatio {
  readonly value: number;
  /** Feeds one frame interval in seconds; returns the new ratio when it changes. */
  sample: (interval: number) => number | null;
  /** Updates the device cap; a different cap restarts adaptation. */
  setMax: (max: number) => void;
  /** Panels differ in cost: let a settled controller adapt to the new one. */
  noteContextChange: () => void;
}

interface DowngradeTrial {
  fromValue: number;
  baseline: number;
  steps: number;
}

export function getScenePixelRatioCap(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1;
  return Math.min(devicePixelRatio, SCENE_MAX_PIXEL_RATIO);
}

export function createAdaptivePixelRatio(initialMax: number): AdaptivePixelRatio {
  const samples = new Float64Array(MAX_WINDOW_FRAMES);
  let max = initialMax;
  let value = initialMax;
  let sampleCount = 0;
  let windowElapsed = 0;
  let slowWindows = 0;
  let fastWindows = 0;
  let lastDirection = 0;
  let directionChanges = 0;
  let trial: DowngradeTrial | null = null;
  // Set when a trial failed: resolution is not what limits this device.
  let resolutionIneffective = false;

  function restartWindows() {
    sampleCount = 0;
    windowElapsed = 0;
    slowWindows = 0;
    fastWindows = 0;
  }

  function reset(nextMax: number) {
    max = nextMax;
    value = nextMax;
    restartWindows();
    lastDirection = 0;
    directionChanges = 0;
    trial = null;
    resolutionIneffective = false;
  }

  function step(direction: -1 | 1) {
    const min = Math.min(MIN_PIXEL_RATIO, max);
    const next = Math.min(max, Math.max(min, value + direction * PIXEL_RATIO_STEP));
    if (next === value) return null;
    if (lastDirection !== 0 && direction !== lastDirection) directionChanges += 1;
    lastDirection = direction;
    value = next;
    return value;
  }

  function takeWindowMedian() {
    const sorted = samples.subarray(0, sampleCount).sort();
    const median = sorted[sampleCount >> 1];
    sampleCount = 0;
    windowElapsed = 0;
    return median;
  }

  /** Returns a ratio to apply, `null` to keep going, or `undefined` once the trial passed. */
  function judgeTrial(activeTrial: DowngradeTrial, median: number) {
    if (median < activeTrial.baseline * TRIAL_IMPROVEMENT) {
      trial = null;
      return undefined;
    }
    if (activeTrial.steps < TRIAL_MAX_STEPS) {
      const next = step(-1);
      if (next !== null) {
        activeTrial.steps += 1;
        return next;
      }
    }
    trial = null;
    resolutionIneffective = true;
    value = activeTrial.fromValue;
    return value;
  }

  function evaluateWindow(median: number) {
    if (trial) {
      const verdict = judgeTrial(trial, median);
      if (verdict !== undefined) return verdict;
    }
    if (resolutionIneffective || directionChanges >= MAX_DIRECTION_CHANGES) return null;

    if (median > SLOW_FRAME_INTERVAL) {
      fastWindows = 0;
      slowWindows += 1;
      if (slowWindows < SLOW_WINDOWS_TO_DOWNGRADE) return null;
      slowWindows = 0;
      const fromValue = value;
      const next = step(-1);
      if (next !== null) trial = { fromValue, baseline: median, steps: 1 };
      return next;
    }

    slowWindows = 0;
    if (median < FAST_FRAME_INTERVAL) {
      fastWindows += 1;
      if (fastWindows < FAST_WINDOWS_TO_UPGRADE) return null;
      fastWindows = 0;
      return step(1);
    }

    fastWindows = 0;
    return null;
  }

  function sample(interval: number) {
    if (!(interval > 0) || interval > MAX_SAMPLED_FRAME_INTERVAL) return null;
    if (!trial && (resolutionIneffective || directionChanges >= MAX_DIRECTION_CHANGES)) return null;

    samples[sampleCount++] = interval;
    windowElapsed += interval;
    const windowOpen = windowElapsed < ADAPTIVE_SAMPLE_WINDOW_SECONDS || sampleCount < MIN_WINDOW_FRAMES;
    if (windowOpen && sampleCount < MAX_WINDOW_FRAMES) return null;
    return evaluateWindow(takeWindowMedian());
  }

  return {
    get value() {
      return value;
    },
    sample,
    setMax(nextMax) {
      if (nextMax !== max) reset(nextMax);
    },
    noteContextChange() {
      // A running trial's baseline belongs to the old panel, so drop it without
      // a verdict. A failed trial stays failed: the cap was not the scene.
      restartWindows();
      trial = null;
      lastDirection = 0;
      directionChanges = 0;
    },
  };
}

/** Times in seconds; `minInterval <= 0` disables the cap. */
export function shouldSkipSceneFrame(
  now: number,
  lastRenderedAt: number | null,
  minInterval: number,
): boolean {
  if (minInterval <= 0 || lastRenderedAt === null) return false;
  return now - lastRenderedAt < minInterval - FRAME_INTERVAL_TOLERANCE;
}
