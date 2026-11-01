import { describe, expect, it } from "vitest";
import { matchNearbyStars } from "@/composables/star-transition";

describe("nearby star handover", () => {
  it("matches local neighbors instead of pairing opposite sides by index", () => {
    const from = Float32Array.from([10, 20, 600, 20, 300, 20]);
    const to = Float32Array.from([610, 20, 20, 20, 305, 20]);
    const match = matchNearbyStars(from, to, 48);
    expect(Array.from(match.targetForSource)).toEqual([1, 0, 2]);
    expect(Array.from(match.nearby)).toEqual([1, 1, 1]);
  });

  it("keeps the shared background fixed and marks distant targets for fading", () => {
    const match = matchNearbyStars(Float32Array.from([0, 0, 400, 0, 800, 0]),
      Float32Array.from([0, 0, 402, 0, 1200, 0]), 64);
    expect(Array.from(match.targetForSource)).toEqual([0, 1, 2]);
    expect(Array.from(match.nearby)).toEqual([1, 1, 0]);
  });

  it("assigns every point once even when many stars overlap or are invisible", () => {
    const from = Float32Array.from([10, 10, 10, 10, 10, 10, NaN, NaN]);
    const to = Float32Array.from([12, 10, NaN, NaN, 12, 10, 12, 10]);
    const match = matchNearbyStars(from, to, 48);
    expect(new Set(match.targetForSource).size).toBe(4);
    expect(Array.from(match.nearby).filter(Boolean)).toHaveLength(3);
    expect(match.nearby[3]).toBe(0);
  });
});
