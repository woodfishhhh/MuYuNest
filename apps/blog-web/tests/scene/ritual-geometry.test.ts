import * as THREE from "three";
import { describe, expect, it } from "vite-plus/test";

import { generateMobiusData, useMobiusStrip } from "@/composables/useMobiusStrip";
import {
  STAR_FIELD_BACK_Z,
  STAR_FIELD_FRONT_Z,
  useStarField,
} from "@/composables/useStarField";

describe("ritual geometry interaction intensity", () => {
  it("adds a depth-only occluder to the mobius strip", () => {
    const mobius = useMobiusStrip();
    const material = mobius.occluder.material as THREE.MeshBasicMaterial;
    const occluderGeometry = mobius.occluder.geometry as THREE.BufferGeometry;
    const surface = generateMobiusData();

    expect(material.colorWrite).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.transparent).toBe(false);
    expect(occluderGeometry.type).toBe("BufferGeometry");
    expect(occluderGeometry.index?.array.length).toBe(surface.triangles.length);
    expect(mobius.line.renderOrder).toBeLessThan(mobius.occluder.renderOrder);
    expect(mobius.occluder.renderOrder).toBeLessThan(80);

    mobius.dispose();
  });

  it("moves star positions forward when warp intensity is enabled", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const starField = useStarField(texture, 1);
    const points = starField.group.children[0] as THREE.Points;
    const positions = points.geometry.attributes.position.array as Float32Array;
    const startZ = positions[2];

    starField.setWarpIntensity(1);
    starField.update(0.1);

    expect(positions[2]).not.toBe(startZ);

    starField.dispose();
    texture.dispose();
  });

  it("supports dark stars with normal blending for the day scene", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const starField = useStarField(texture, 1);
    const points = starField.group.children[0] as THREE.Points;
    const material = points.material as THREE.PointsMaterial;
    const positions = points.geometry.attributes.position.array as Float32Array;
    const startZ = positions[2];

    starField.setColor(0x111111, THREE.NormalBlending);
    starField.setWarpIntensity(1);
    starField.update(0.1);

    expect(material.color.getHex()).toBe(0x111111);
    expect(material.blending).toBe(THREE.NormalBlending);
    expect(positions[2]).not.toBe(startZ);

    starField.dispose();
    texture.dispose();
  });

  it("wraps warped stars before they can cross the camera and cover the interface", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const starField = useStarField(texture, 1);
    const points = starField.group.children[0] as THREE.Points;
    const positions = points.geometry.attributes.position.array as Float32Array;
    positions[2] = STAR_FIELD_FRONT_Z - 0.1;

    starField.setWarpIntensity(1);
    starField.update(0.1);

    expect(positions[2]).toBeGreaterThanOrEqual(STAR_FIELD_BACK_Z);
    expect(positions[2]).toBeLessThanOrEqual(STAR_FIELD_FRONT_Z);

    starField.dispose();
    texture.dispose();
  });

  it("keeps rotated stars behind the front plane in world space", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const starField = useStarField(texture, 1);
    const points = starField.group.children[0] as THREE.Points;
    const positions = points.geometry.attributes.position.array as Float32Array;
    positions[0] = -40;
    positions[1] = 0;
    positions[2] = 0;

    starField.update(60);
    starField.group.updateMatrixWorld(true);
    const worldPosition = new THREE.Vector3(positions[0], positions[1], positions[2]);
    points.localToWorld(worldPosition);

    expect(worldPosition.z).toBeLessThanOrEqual(STAR_FIELD_FRONT_Z);

    starField.dispose();
    texture.dispose();
  });
});
