import { describe, expect, it } from "vite-plus/test";
import * as THREE from "three";
import { getBlogDockTransform } from "@/components/scene/blog-dock";

describe("blog geometry docking", () => {
  it.each([[1440, 900], [390, 844]])(
    "preserves the centered model's projected shape at the corner of a %i × %i viewport",
    (width, height) => {
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(0.4, 0.2, 12);
      camera.lookAt(0.6, 0.35, 0);
      camera.updateMatrixWorld();
      const viewport = { left: 0, top: 0, width, height };
      const anchor = { left: 160, top: 24, width: 50, height: 28 };
      const target = getBlogDockTransform(camera, viewport, anchor, 10);
      const scale = new THREE.Vector3().setScalar(target.scale);
      const dockMatrix = new THREE.Matrix4()
        .compose(target.position, camera.quaternion, scale)
        .multiply(target.projectionCorrection);
      const center = new THREE.Vector3(0, 0, -12).applyMatrix4(camera.matrixWorld);
      const centeredMatrix = new THREE.Matrix4().compose(center, camera.quaternion, scale);
      const pose = new THREE.Euler(0.5, 0.7, 0.2);
      for (let i = 0; i < 8; i++) {
        const vertex = new THREE.Vector3(i & 1 ? 2 : -2, i & 2 ? 2 : -2, i & 4 ? 2 : -2)
          .applyEuler(pose);
        const docked = vertex.clone().applyMatrix4(dockMatrix).project(camera);
        const centered = vertex.clone().applyMatrix4(centeredMatrix).project(camera);
        expect((docked.x - centered.x) * width / 2).toBeCloseTo(anchor.left + 25 - width / 2);
        expect((centered.y - docked.y) * height / 2).toBeCloseTo(anchor.top + 14 - height / 2);
      }
    },
  );

  it("introduces and reverses the view correction continuously", () => {
    const camera = new THREE.PerspectiveCamera(75, 1.6, 0.1, 1000);
    camera.updateMatrixWorld();
    const viewport = { left: 0, top: 0, width: 1440, height: 900 };
    const anchor = { left: 160, top: 24, width: 50, height: 28 };
    const matrix = (progress: number) => getBlogDockTransform(camera, viewport, anchor, 10, progress).projectionCorrection;
    expect(matrix(0).equals(new THREE.Matrix4())).toBe(true);
    const full = matrix(1).elements;
    const half = matrix(0.5).elements;
    expect(half[8]).toBeCloseTo(full[8] / 2);
    expect(half[9]).toBeCloseTo(full[9] / 2);
    expect(Math.abs(matrix(0.501).elements[8] - half[8])).toBeLessThan(0.002);
  });

  it.each([
    [1440, 900, 185, 24],
    [390, 844, 160, 16],
  ])("keeps the geometry on the DOM anchor in a %i × %i viewport", (width, height, left, top) => {
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0.4, 0.2, 12);
    camera.lookAt(0.6, 0.35, 0);
    camera.updateMatrixWorld();
    const anchor = { left, top, width: 50.4, height: 28 };
    const target = getBlogDockTransform(camera, { left: 0, top: 0, width, height }, anchor, 10);
    const ndc = target.position.clone().project(camera);
    expect((ndc.x + 1) * width / 2).toBeCloseTo(left + anchor.width / 2);
    expect((1 - ndc.y) * height / 2).toBeCloseTo(top + anchor.height / 2);

    const edge = new THREE.Vector3(5 * target.scale, 0, 0)
      .applyQuaternion(camera.quaternion).add(target.position).project(camera);
    expect((edge.x - ndc.x) * width).toBeCloseTo(33.6);
  });

  it("compensates for canvas offsets and different geometry sizes", () => {
    const camera = new THREE.PerspectiveCamera(75, 2, 0.1, 1000);
    camera.updateMatrixWorld();
    const viewport = { left: 30, top: 20, width: 1200, height: 600 };
    const anchor = { left: 180, top: 40, width: 50, height: 28 };
    const small = getBlogDockTransform(camera, viewport, anchor, 6);
    const large = getBlogDockTransform(camera, viewport, anchor, 10);
    expect(small.scale * 6).toBeCloseTo(large.scale * 10);
    const ndc = small.position.clone().project(camera);
    expect((ndc.x + 1) * viewport.width / 2 + viewport.left).toBeCloseTo(205);
    expect((1 - ndc.y) * viewport.height / 2 + viewport.top).toBeCloseTo(54);
  });
});
