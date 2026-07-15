import * as THREE from "three";
import { describe, expect, it } from "vite-plus/test";

import { generateMobiusData, useMobiusStrip } from "@/composables/useMobiusStrip";

function pairKey(a: number, b: number) {
  return `${a}:${b}`;
}

describe("mobius strip", () => {
  it("generateMobiusData returns params and edges", () => {
    const result = generateMobiusData();

    expect(result.params.segmentsU).toBeGreaterThan(0);
    expect(result.params.segmentsV).toBeGreaterThan(0);
    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.edges.length).toBeGreaterThan(0);
  });

  it("seam edges wrap last U segment to first U segment with reversed V", () => {
    const segmentsU = 4;
    const segmentsV = 3;
    const result = generateMobiusData({ segmentsU, segmentsV });

    const edgeSet = new Set<string>();
    for (let i = 0; i < result.edges.length; i += 2) {
      edgeSet.add(pairKey(result.edges[i], result.edges[i + 1]));
    }

    const index = (u: number, v: number) => u * segmentsV + v;
    for (let v = 0; v < segmentsV; v++) {
      const reversedV = segmentsV - 1 - v;
      expect(edgeSet.has(pairKey(index(segmentsU - 1, v), index(0, reversedV)))).toBe(true);
      if (reversedV !== v) {
        expect(edgeSet.has(pairKey(index(segmentsU - 1, v), index(0, v)))).toBe(false);
      }
    }
  });

  it("useMobiusStrip returns group, line and hitMesh", () => {
    const strip = useMobiusStrip();

    expect(strip.group).toBeInstanceOf(THREE.Group);
    expect(strip.line).toBeInstanceOf(THREE.LineSegments);
    expect(strip.hitMesh).toBeInstanceOf(THREE.Mesh);

    strip.dispose();
  });

  it("uses a lightweight torus for pointer hit testing", () => {
    const strip = useMobiusStrip();
    const geometry = strip.hitMesh.geometry as THREE.TorusGeometry;

    expect(geometry.parameters.radialSegments).toBe(8);
    expect(geometry.parameters.tubularSegments).toBe(32);
    expect(geometry.index?.count).toBeLessThanOrEqual(8 * 32 * 6);

    strip.dispose();
  });

  it("setOpacity updates line material opacity", () => {
    const strip = useMobiusStrip();
    strip.setOpacity(0.2);

    const material = strip.line.material as THREE.LineBasicMaterial;
    expect(material.opacity).toBeCloseTo(0.2);

    strip.dispose();
  });

  it("lerpColor moves line color toward target", () => {
    const strip = useMobiusStrip();
    const material = strip.line.material as THREE.LineBasicMaterial;
    const before = material.color.clone();

    strip.lerpColor(new THREE.Color("#ffffff"), 0.5);

    expect(material.color.r).toBeGreaterThan(before.r);
    expect(material.color.g).toBeGreaterThan(before.g);
    expect(material.color.b).toBeGreaterThan(before.b);

    strip.dispose();
  });

  it("moves into a camera-facing ring spin when interaction intensity is high", () => {
    const strip = useMobiusStrip();

    strip.group.rotation.set(0.5, 0.5, 0);
    strip.setInteractionIntensity(1);
    strip.update(1);

    expect(strip.group.rotation.x).toBeCloseTo(0.32, 1);
    expect(strip.group.rotation.y).toBeCloseTo(0.36, 1);
    expect(strip.group.rotation.z).toBeGreaterThan(1.4);

    strip.dispose();
  });

  it("dispose is callable", () => {
    const strip = useMobiusStrip();
    expect(() => strip.dispose()).not.toThrow();
  });
});
