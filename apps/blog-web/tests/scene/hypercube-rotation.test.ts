import { describe, expect, it } from "vite-plus/test";

import {
  normalizeRotationForTween,
  shouldTweenRotation,
} from "@/components/scene/hypercube-rotation";

describe("normalizeRotationForTween", () => {
  it("collapses accumulated full turns before tweening back to the canonical pose", () => {
    const target = { x: 0.5, y: 0.5, z: 0 };
    const normalized = normalizeRotationForTween(
      {
        x: 0.5 + Math.PI * 8,
        y: 0.5 + Math.PI * 12,
        z: Math.PI * 6,
      },
      target,
    );

    expect(normalized.x).toBeCloseTo(0.5, 5);
    expect(normalized.y).toBeCloseTo(0.5, 5);
    expect(normalized.z).toBeCloseTo(0, 5);
  });

  it("chooses the shortest equivalent path for each axis", () => {
    const target = { x: 0.5, y: 0.5, z: 0 };
    const normalized = normalizeRotationForTween(
      {
        x: target.x + Math.PI * 1.9,
        y: target.y - Math.PI * 1.9,
        z: target.z + Math.PI * 2.1,
      },
      target,
    );

    expect(Math.abs(normalized.x - target.x)).toBeLessThan(Math.PI);
    expect(Math.abs(normalized.y - target.y)).toBeLessThan(Math.PI);
    expect(Math.abs(normalized.z - target.z)).toBeLessThan(Math.PI);
    expect(normalized.x).toBeCloseTo(target.x - Math.PI * 0.1, 5);
    expect(normalized.y).toBeCloseTo(target.y + Math.PI * 0.1, 5);
    expect(normalized.z).toBeCloseTo(target.z + Math.PI * 0.1, 5);
  });
});

describe("shouldTweenRotation", () => {
  it("does not request a rotation tween when route layout keeps the current pose", () => {
    const current = { x: 0.42, y: 1.25, z: -0.15 };

    expect(shouldTweenRotation(current, { ...current })).toBe(false);
  });

  it("requests a rotation tween when focus mode restores a saved pose", () => {
    expect(
      shouldTweenRotation(
        { x: 0.42, y: 1.25, z: -0.15 },
        { x: 0.5, y: 0.5, z: 0 },
      ),
    ).toBe(true);
  });
});
