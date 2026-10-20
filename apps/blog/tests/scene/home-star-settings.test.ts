import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { HOME_STAR_SETTINGS, HOME_STAR_SEED } from "@/composables/home-star-motion";
import { createStarMotion } from "@/composables/star-motion";
import selectedPlayground from "@/content/star-playground.json";
import { useStarField, STAR_FIELD_FRONT_Z, STAR_FIELD_BACK_Z } from "@/composables/useStarField";

describe("selected Home star settings", () => {
  it("uses the complete selected rays configuration, including count, density and size", () => {
    expect(HOME_STAR_SETTINGS).toEqual(selectedPlayground.modes.rays);
    expect(HOME_STAR_SETTINGS).toEqual({
      bunches: 10, spread: 4, clumping: 1, curvature: 1, flow: 0.2, parallax: 1.55,
      count: 19, density: 0.22, starSize: 1.5, reach: 1.4, trail: 1, angle: 1, gravity: 1, turbulence: 0.4,
    });
    expect(HOME_STAR_SEED).toBe(716);
  });

  it.each([[1651, 871], [390, 844]])("matches the selected playground surface at %i x %i", (width, height) => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const field = useStarField(texture);
    const points = field.group.children[0] as THREE.Points;
    const position = points.geometry.attributes.position.array as Float32Array;
    const original = position.slice();
    const expected = position.slice();
    const alpha = new Float32Array(5000).fill(1); const sizes = new Float32Array(5000).fill(1);
    const preview = createStarMotion(expected, alpha, sizes, HOME_STAR_SEED, selectedPlayground.modes.rays, "rays");
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000); camera.position.z = 10;
    const view = { camera, width, height, pointer: new THREE.Vector2(0.15, -0.2) };
    try {
      field.setCollectMode(true, true); field.update(0, view);
      preview.update(0, true, field.group, view, true);
      expect(position).toEqual(expected);
      expect(points.geometry.attributes.starOpacity.array).toEqual(alpha);
      expect(points.geometry.attributes.starSize.array).toEqual(sizes);
      expect(position).not.toEqual(original);
      let moved = 0;
      for (let i = 0; i < 5000; i++) if (position[i * 3] !== original[i * 3]) moved++;
      expect(moved).toBe(1100);
      field.setCollectMode(true);
      for (let frame = 0; frame < 60; frame++) {
        field.update(1 / 60, view);
        preview.update(1 / 60, true, field.group, view);
        expect(position.every((value, i) => value === expected[i]), `frame ${frame} positions`).toBe(true);
        expect(points.geometry.attributes.starOpacity.array.every((value, i) => value === alpha[i]), `frame ${frame} opacity`).toBe(true);
        expect(points.geometry.attributes.starSize.array.every((value, i) => value === sizes[i]), `frame ${frame} size`).toBe(true);
      }
      field.setCollectMode(false, true); field.update(0, view);
      expect(position).toEqual(original);
      expect(Array.from(points.geometry.attributes.starOpacity.array).every(value => value === 1)).toBe(true);
    } finally { field.dispose(); texture.dispose(); }
  });

  it("preserves warp depth before, during and after collection", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const field = useStarField(texture, 120);
    const positions = (field.group.children[0] as THREE.Points).geometry.attributes.position.array as Float32Array;
    const before = positions.slice();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000); camera.position.z = 10;
    const view = { camera, width: 900, height: 900, pointer: new THREE.Vector2() };
    try {
      field.setWarpIntensity(1);
      field.update(0.1, view); expect(positions).not.toEqual(before);
      field.setCollectMode(true, true); field.update(0, view);
      field.update(0.1, view);
      field.setCollectMode(false, true); field.update(0, view);
      for (let i = 2; i < positions.length; i += 3) {
        const raw = before[i] + 6.8;
        const expected = raw > STAR_FIELD_FRONT_Z ? STAR_FIELD_BACK_Z + THREE.MathUtils.euclideanModulo(raw - STAR_FIELD_BACK_Z, STAR_FIELD_FRONT_Z - STAR_FIELD_BACK_Z) : raw;
        expect(positions[i]).toBeCloseTo(expected, 4);
      }
    } finally { field.dispose(); texture.dispose(); }
  });
});
