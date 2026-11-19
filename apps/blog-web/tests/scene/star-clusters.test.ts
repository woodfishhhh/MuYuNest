import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CLUSTER_PRESETS, bunchRadius, createStarClusters, normalizeClusterSettings } from "@/components/playground/star-clusters";
import { createStarClock } from "@/composables/star-clock";

function fixture() {
  const positions = Float32Array.from({ length: 900 }, (_, i) => Math.sin(i * 1.3) * (i % 3 === 2 ? -7 : 12));
  const opacity = new Float32Array(300).fill(1); const sizes = new Float32Array(300).fill(1);
  const group = new THREE.Group(); group.rotation.z = 0.4;
  const camera = new THREE.PerspectiveCamera(75, 1440 / 900, 0.1, 1000); camera.position.z = 10;
  const view = { camera, width: 1440, height: 900, pointer: new THREE.Vector2(0.2, -0.1) };
  return { positions, opacity, sizes, group, view };
}

describe("star line playground", () => {
  it("matches the actual Home star clock point for point in the reference preset", () => {
    const f = fixture(); const referencePositions = f.positions.slice(); const referenceOpacity = f.opacity.slice();
    const clock = createStarClock(referencePositions, referenceOpacity);
    const preview = createStarClusters(f.positions, f.opacity, f.sizes, 716, CLUSTER_PRESETS[0].settings);
    for (const active of [true, false, true]) {
      clock.setActive(active);
      for (let frame = 0; frame < 90; frame++) {
        clock.update(1 / 60, f.group, f.view);
        preview.update(1 / 60, active, f.group, f.view);
        expect(f.positions).toEqual(referencePositions);
        expect(f.opacity).toEqual(referenceOpacity);
      }
    }
    expect(f.sizes.every(value => value === 1)).toBe(true);
  });

  it("bunches stars along each line without reversing their order or moving its endpoints", () => {
    for (const phase of [0, 0.3, 2.7]) {
      expect(bunchRadius(0, 4, 1, phase)).toBeCloseTo(0);
      expect(bunchRadius(1, 4, 1, phase)).toBeCloseTo(1);
      const steps = Array.from({ length: 101 }, (_, i) => bunchRadius(i / 100, 4, 1, phase));
      const gaps = steps.slice(1).map((value, i) => value - steps[i]);
      expect(gaps.every(gap => gap > 0)).toBe(true);
      expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(10);
    }
  });

  it("validates saved parameters and retains the original speed as the default", () => {
    expect(normalizeClusterSettings({ bunches: 100, spread: NaN, clumping: -1, flow: Infinity }))
      .toMatchObject({ bunches: 24, spread: 0, clumping: 0, flow: 1 });
  });

  it.each(CLUSTER_PRESETS)("keeps $name finite and restores the underlying field", ({ settings }) => {
    const f = fixture(); const original = f.positions.slice();
    const motion = createStarClusters(f.positions, f.opacity, f.sizes, 716, settings);
    for (let i = 0; i < 120; i++) motion.update(1 / 60, true, f.group, f.view);
    expect(f.positions).not.toEqual(original);
    expect(f.positions.every(Number.isFinite)).toBe(true);
    expect(f.opacity.every(alpha => alpha >= 0 && alpha <= 1)).toBe(true);
    motion.update(0, true, f.group, f.view, true); const still = f.positions.slice();
    motion.update(0, true, f.group, f.view, true); expect(f.positions).toEqual(still);
    for (let i = 0; i < 120; i++) motion.update(1 / 60, false, f.group, f.view);
    expect(f.positions).toEqual(original);
    expect(f.opacity.every(alpha => alpha === 1)).toBe(true);
    expect(f.sizes.every(size => size === 1)).toBe(true);
  });
});
