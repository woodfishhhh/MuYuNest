import * as THREE from "three";
import { describe, expect, it } from "vite-plus/test";

import {
  generateHypercubeData,
  generateHypercubeSurfaceIndices,
  useHypercube,
} from "@/composables/useHypercube";

describe("useHypercube", () => {
  it("uses an expanded hit sphere for the larger night geometry", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const hypercube = useHypercube(texture);
    const hitGeometry = hypercube.hitMesh.geometry as THREE.SphereGeometry;

    expect(hitGeometry.parameters.radius).toBeCloseTo(3.1);

    hypercube.dispose();
    texture.dispose();
  });

  it("adds a depth-only occluder between the visible skeleton and orbit cards", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const hypercube = useHypercube(texture);
    const material = hypercube.occluder.material as THREE.MeshBasicMaterial;
    const occluderGeometry = hypercube.occluder.geometry as THREE.BufferGeometry;
    const { vertices } = generateHypercubeData();

    expect(material.colorWrite).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.transparent).toBe(true);
    expect(occluderGeometry.type).toBe("BufferGeometry");
    expect(occluderGeometry.index?.array.length).toBe(
      generateHypercubeSurfaceIndices(vertices).length,
    );
    expect(hypercube.line.renderOrder).toBeLessThan(hypercube.occluder.renderOrder);
    expect(hypercube.points.renderOrder).toBeLessThan(hypercube.occluder.renderOrder);
    expect(hypercube.occluder.renderOrder).toBeLessThan(80);

    hypercube.dispose();
    texture.dispose();
  });

  it("keeps all 4D wireframe edges visible when the Case layout fades the hypercube", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const hypercube = useHypercube(texture);
    const lineMaterial = hypercube.line.material as THREE.LineBasicMaterial;
    const occluderMaterial = hypercube.occluder.material as THREE.MeshBasicMaterial;

    hypercube.setOpacity(0.32);

    expect(lineMaterial.transparent).toBe(true);
    expect(occluderMaterial.transparent).toBe(true);
    expect(occluderMaterial.depthWrite).toBe(true);
    expect(hypercube.line.renderOrder).toBeLessThan(hypercube.occluder.renderOrder);
    expect(hypercube.occluder.visible).toBe(true);

    hypercube.setOpacity(1);

    expect(lineMaterial.transparent).toBe(false);
    expect(occluderMaterial.transparent).toBe(true);
    expect(hypercube.occluder.visible).toBe(true);

    hypercube.dispose();
    texture.dispose();
  });

  it("keeps the high-intensity hypercube close to its base 16-point shape", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const hypercube = useHypercube(texture);
    const positions = hypercube.line.geometry.attributes.position.array as Float32Array;

    hypercube.setInteractionIntensity(1);
    hypercube.update(0.5);
    const first = positions.slice(0, 48);
    hypercube.update(0.5);
    const second = positions.slice(0, 48);

    const largestMovement = first.reduce((max, value, index) => {
      return Math.max(max, Math.abs(value - second[index]));
    }, 0);
    expect(largestMovement).toBeLessThan(0.08);

    hypercube.dispose();
    texture.dispose();
  });
});
