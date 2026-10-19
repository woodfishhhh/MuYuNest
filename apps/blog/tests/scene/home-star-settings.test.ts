import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createStarClusters, HOME_STAR_SETTINGS, HOME_STAR_SEED } from "@/composables/star-clusters";
import { useStarField, STAR_FIELD_FRONT_Z, STAR_FIELD_BACK_Z } from "@/composables/useStarField";

describe("selected Home star settings", () => {
  it("uses the exact six values selected in the playground", () => {
    expect(HOME_STAR_SETTINGS).toEqual({ bunches: 8, spread: 1, clumping: 0.05, curvature: 1, flow: 0.25, parallax: 1 });
  });

  it.each([[1651, 871], [390, 844]])("matches the selected playground surface at %i x %i", (width, height) => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const field = useStarField(texture);
    const points = field.group.children[0] as THREE.Points;
    const position = points.geometry.attributes.position.array as Float32Array;
    const original = position.slice();
    const expected = position.slice();
    const alpha = new Float32Array(5000).fill(1); const sizes = new Float32Array(5000).fill(1);
    const preview = createStarClusters(expected, alpha, sizes, HOME_STAR_SEED, HOME_STAR_SETTINGS);
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000); camera.position.z = 10;
    const view = { camera, width, height, pointer: new THREE.Vector2(0.15, -0.2) };
    try {
      field.setCollectMode(true, true); field.update(0, view);
      preview.update(0, true, field.group, view, true);
      expect(position).toEqual(expected);
      expect(points.geometry.attributes.starOpacity.array).toEqual(alpha);
      expect(points.geometry.attributes.starSize.array).toEqual(sizes);
      expect(position).not.toEqual(original);
      field.setCollectMode(false, true); field.update(0, view);
      expect(position).toEqual(original);
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
