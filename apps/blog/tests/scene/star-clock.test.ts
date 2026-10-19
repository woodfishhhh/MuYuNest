import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createStarClock, STAR_CLOCK_RAYS } from "@/composables/star-clock";
import { ORIGINAL_STAR_SETTINGS } from "@/composables/star-clusters";
import { useStarField } from "@/composables/useStarField";
import { getHomeGeometryAnchor } from "@/components/scene/home-card-flight/layout";

function fixture(width = 1440, height = 900) {
  const texture = new THREE.CanvasTexture(document.createElement("canvas"));
  const field = useStarField(texture, 5000, ORIGINAL_STAR_SETTINGS);
  const points = field.group.children[0] as THREE.Points;
  const positions = points.geometry.attributes.position.array as Float32Array;
  const opacity = points.geometry.attributes.starOpacity.array as Float32Array;
  const before = positions.slice();
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(0.3, -0.2, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const view = { width, height, camera, pointer: new THREE.Vector2() };
  return { texture, field, points, positions, opacity, before, view,
    dispose: () => { field.dispose(); texture.dispose(); } };
}

describe("Home star clock", () => {
  it.each([[1651, 871], [390, 844]])("projects existing stars onto twelve screen-space spokes at %i x %i", (width, height) => {
    const f = fixture(width, height);
    try {
      f.field.setCollectMode(true, true); f.field.update(0, f.view);
      const anchor = getHomeGeometryAnchor({ left: 0, top: 0, width, height });
      const cx = anchor.left + anchor.width / 2;
      const cy = anchor.top + anchor.height / 2;
      const counts = Array(12).fill(0);
      let unchanged = 0;
      const point = new THREE.Vector3();
      for (let i = 0; i < f.positions.length; i += 3) {
        if (f.positions[i] === f.before[i] && f.positions[i + 1] === f.before[i + 1] && f.positions[i + 2] === f.before[i + 2]) { unchanged++; continue; }
        point.fromArray(f.positions, i).applyMatrix4(f.field.group.matrixWorld).project(f.view.camera);
        const x = (point.x + 1) * width / 2 - cx;
        const y = (1 - point.y) * height / 2 - cy;
        const turns = THREE.MathUtils.euclideanModulo(Math.atan2(x, -y), Math.PI * 2) / (Math.PI / 6);
        expect(Math.abs(turns - Math.round(turns))).toBeLessThan(0.001);
        counts[Math.round(turns) % 12]++;
        expect(Math.hypot(x, y)).toBeGreaterThan(40);
      }
      expect(counts).toEqual(Array(STAR_CLOCK_RAYS).fill(100));
      expect(unchanged).toBe(3800);
      expect(f.points.geometry.attributes.position.count).toBe(5000);
      expect(f.field.group.children).toHaveLength(1);
    } finally { f.dispose(); }
  });

  it("morphs continuously, flows outward, reverses midway and restores the original points", () => {
    const f = fixture();
    try {
      f.field.setCollectMode(true); f.field.update(0, f.view);
      expect(f.positions).toEqual(f.before);
      for (let i = 0; i < 6; i++) f.field.update(1 / 60, f.view);
      const midway = f.positions.slice();
      expect(midway).not.toEqual(f.before);
      f.field.setCollectMode(false); f.field.update(0, f.view);
      expect(f.positions).toEqual(midway);
      for (let i = 0; i < 90; i++) f.field.update(1 / 60, f.view);
      expect(f.positions).toEqual(f.before);
      expect(f.opacity.every(value => value === 1)).toBe(true);
      f.field.setCollectMode(true);
      for (let i = 0; i < 90; i++) f.field.update(1 / 60, f.view);
      const flowing = f.positions.slice();
      f.field.update(0.1, f.view);
      expect(f.positions).not.toEqual(flowing);
      expect(f.positions.every(Number.isFinite)).toBe(true);
    } finally { f.dispose(); }
  });

  it("keeps a static formation for reduced motion, adapts to resize and exits immediately", () => {
    const f = fixture();
    try {
      f.field.setCollectMode(true, true); f.field.update(0, f.view);
      const staticPositions = f.positions.slice();
      f.field.update(2, f.view);
      expect(f.positions).toEqual(staticPositions);
      f.view.width = 390; f.view.height = 844; f.view.camera.aspect = 390 / 844; f.view.camera.updateProjectionMatrix();
      f.field.update(0, f.view);
      expect(f.positions).not.toEqual(staticPositions);
      f.field.setCollectMode(false, true); f.field.update(0, f.view);
      expect(f.positions).toEqual(f.before);
    } finally { f.dispose(); }
  });

  it("moves stars outward in screen space and adds depth-dependent pointer parallax", () => {
    const f = fixture();
    const project = (index: number) => new THREE.Vector3().fromArray(f.positions, index * 3)
      .applyMatrix4(f.field.group.matrixWorld).project(f.view.camera);
    const radius = (point: THREE.Vector3) => Math.hypot(point.x * f.view.width / 2, (point.y + 0.024) * f.view.height / 2);
    try {
      f.field.setCollectMode(true);
      for (let i = 0; i < 90; i++) f.field.update(1 / 60, f.view);
      const index = f.opacity.findIndex((alpha, i) => alpha > 0.3 && alpha < 0.9 && radius(project(i)) > 100 && radius(project(i)) < 180);
      expect(index).toBeGreaterThanOrEqual(0);
      const before = radius(project(index));
      f.field.update(0.1, f.view);
      expect(radius(project(index))).toBeGreaterThan(before);
      const centered = project(index).x;
      f.view.pointer.set(1, 0); f.field.update(0, f.view);
      expect(project(index).x).toBeGreaterThan(centered);
    } finally { f.dispose(); }
  });

  it("leaves small star fields and the original warp source untouched", () => {
    const positions = new Float32Array([1, 2, 3]);
    const clock = createStarClock(positions, new Float32Array([1]));
    clock.setActive(true);
    expect(clock.sourceFor(0)).toBe(positions);
    expect(clock.update(0.1, new THREE.Group())).toBe(false);
  });
});
