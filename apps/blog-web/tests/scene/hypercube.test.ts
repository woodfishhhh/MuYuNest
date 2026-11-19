import * as THREE from "three";
import { describe, expect, it } from "vite-plus/test";

import {
  generateHypercubeData,
  generateHypercubeSurfaceIndices,
  useHypercube,
} from "@/composables/useHypercube";

describe("useHypercube", () => {
  it("reuses the GPU position buffer and stops uploads while docked", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const cube = useHypercube(texture);
    const position = cube.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    expect(cube.occluder.geometry.getAttribute("position")).toBe(position);
    cube.update(1);
    cube.setDockProgress(1);
    cube.update(1);
    const dockedVersion = position.version;
    cube.update(1);
    expect(position.version).toBe(dockedVersion);
    cube.setDockProgress(0);
    cube.update(0);
    expect(position.version).toBe(dockedVersion + 1);
    cube.dispose();
    texture.dispose();
  });

  it("shrinks docked vertex sprites and restores their original size", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const cube = useHypercube(texture);
    const material = cube.points.material as THREE.PointsMaterial;
    cube.setPointScale(0.07);
    expect(material.size).toBeCloseTo(0.018);
    cube.setPointScale(1);
    expect(material.size).toBeCloseTo(0.15);
    cube.dispose();
    texture.dispose();
  });

  it("fixes only the docked projection as nested cubes and resumes morphing on exit", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const cube = useHypercube(texture);
    const positions = cube.line.geometry.attributes.position.array as Float32Array;
    cube.update(10);
    const expanded = positions.slice();
    cube.setDockProgress(1);
    cube.update(1);
    const docked = positions.slice();
    expect(Math.abs(docked[0])).toBeCloseTo(4 / 3.5);
    expect(Math.abs(docked[24])).toBeCloseTo(4 / 1.5);
    cube.update(100);
    expect(positions).toEqual(docked);
    expect(cube.occluder.geometry.attributes.position.array).toEqual(docked);
    cube.setDockProgress(0);
    cube.update(0);
    expect(positions).toEqual(expanded);
    cube.update(1);
    expect(positions).not.toEqual(expanded);
    cube.dispose();
    texture.dispose();
  });

  it("blends from the current deformed shape and reverses without a shape jump", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    const cube = useHypercube(texture);
    const positions = cube.line.geometry.attributes.position.array as Float32Array;
    cube.update(20);
    const deformed = positions.slice();
    cube.setDockProgress(1);
    cube.update(0);
    const rigid = positions.slice();
    cube.setDockProgress(0.5);
    cube.update(0);
    const midpoint = positions.slice();
    midpoint.forEach((value, i) => expect(value).toBeCloseTo((deformed[i] + rigid[i]) / 2));
    cube.setDockProgress(0.501);
    cube.update(0);
    const smallStep = Math.max(...Array.from(positions, (value, i) => Math.abs(value - midpoint[i])));
    expect(smallStep).toBeLessThan(0.01);
    cube.setDockProgress(0.5);
    cube.update(0);
    expect(positions).toEqual(midpoint);
    cube.dispose();
    texture.dispose();
  });

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
