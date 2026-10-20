import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createStarMotion } from "@/components/playground/star-motion";
import { STAR_MODES, COMMON_CONTROLS, MODE_CONTROLS, createModeSettings, normalizePlaygroundSettings } from "@/components/playground/star-clusters";

function fixture() {
  const positions = Float32Array.from({ length: 900 }, (_, i) => Math.sin(i * 1.3) * 12);
  const opacity = new Float32Array(300).fill(1);
  const sizes = new Float32Array(300).fill(1);
  const group = new THREE.Group(); group.rotation.z = 0.4;
  const camera = new THREE.PerspectiveCamera(75, 1440 / 900, 0.1, 1000); camera.position.z = 10;
  return { positions, opacity, sizes, group, view: { camera, width: 1440, height: 900, pointer: new THREE.Vector2(0.2, -0.1) } };
}

describe("star motion playground", () => {
  it.each(STAR_MODES)("animates $id and restores the original field", ({ id, defaults }) => {
    const f = fixture(); const original = f.positions.slice();
    const motion = createStarMotion(f.positions, f.opacity, f.sizes, 716, defaults, id);
    for (let i = 0; i < 60; i++) motion.update(1 / 60, true, f.group, f.view);
    const first = f.positions.slice();
    for (let i = 0; i < 60; i++) motion.update(1 / 60, true, f.group, f.view);
    expect(f.positions).not.toEqual(first);
    motion.update(0, true, f.group, f.view); const paused = f.positions.slice();
    motion.update(0, true, f.group, f.view); expect(f.positions).toEqual(paused);
    for (let i = 0; i < 60; i++) motion.update(1 / 60, false, f.group, f.view);
    expect(f.positions).toEqual(original);
    expect(f.opacity.every(value => value === 1)).toBe(true);
    expect(f.sizes.every(value => value === 1)).toBe(true);
  });

  it.each(STAR_MODES)("keeps $id finite at both ends of every parameter range", ({ id, defaults }) => {
    for (const edge of ["min", "max"] as const) {
      const limits = Object.fromEntries([...COMMON_CONTROLS, ...MODE_CONTROLS[id]].map(control => [control.key, control[edge]]));
      const settings = normalizePlaygroundSettings({ ...defaults, ...limits }, id);
      const f = fixture();
      const motion = createStarMotion(f.positions, f.opacity, f.sizes, 716, settings, id);
      for (let i = 0; i < 90; i++) motion.update(1 / 30, true, f.group, f.view);
      expect(f.positions.every(Number.isFinite)).toBe(true);
      expect(f.opacity.every(value => value >= 0 && value <= 1)).toBe(true);
      expect(f.sizes.every(value => Number.isFinite(value) && value > 0)).toBe(true);
    }
  });

  it("uses all twelve spokes at exactly 50 percent density", () => {
    const f = fixture();
    const settings = { ...STAR_MODES[0].defaults, density: 0.5, spread: 0, clumping: 0, curvature: 0, parallax: 0 };
    const motion = createStarMotion(f.positions, f.opacity, f.sizes, 716, settings, "rays");
    motion.update(0, true, f.group, f.view, true);
    const rays = new Set<number>();
    const point = new THREE.Vector3();
    for (let i = 0; i < f.opacity.length; i++) {
      if (Math.abs(f.opacity[i] - 0.22) < 1e-6) continue;
      point.fromArray(f.positions, i * 3).applyMatrix4(f.group.matrixWorld).project(f.view.camera);
      const angle = Math.atan2(point.x * 720, -((1 - point.y) * 450 - 900 * 0.512));
      rays.add(THREE.MathUtils.euclideanModulo(Math.round(angle / (Math.PI / 6)), 12));
    }
    expect(rays.size).toBe(12);
  });

  it("morphs without jumping, replays deterministically and honors reduced motion", () => {
    const f = fixture(); const modes = createModeSettings();
    const motion = createStarMotion(f.positions, f.opacity, f.sizes, 716, modes.rays, "rays");
    motion.update(0, true, f.group, f.view, true); const rays = f.positions.slice();
    motion.configure(modes.comet, "comet");
    motion.update(0, true, f.group, f.view); expect(f.positions).toEqual(rays);
    motion.update(0, true, f.group, f.view, true); const comet = f.positions.slice();
    expect(comet).not.toEqual(rays);
    motion.update(0.1, true, f.group, f.view, true); expect(f.positions).toEqual(comet);
    motion.replay(); motion.update(0, true, f.group, f.view, true); expect(f.positions).toEqual(comet);
    motion.configure(modes.fall, "fall"); motion.update(0, true, f.group, f.view, true);
    expect(f.positions).not.toEqual(comet);
  });

  it("normalizes saved data, preserves generous values, and gives every mode independent settings", () => {
    expect(normalizePlaygroundSettings({ count: 99, flow: 6.5, curvature: -3, starSize: NaN, density: Infinity, spread: 3.2 }, "rays"))
      .toMatchObject({ count: 36, flow: 6.5, curvature: -3, starSize: 1.2, density: 0.48, spread: 3.2 });
    expect(normalizePlaygroundSettings({ count: 0, angle: -1000, flow: -4 }, "comet"))
      .toMatchObject({ count: 1, angle: -180, flow: 0 });
    const first = createModeSettings(); const second = createModeSettings();
    first.rays.flow = 7;
    expect(first.comet.flow).toBe(0.55); expect(second.rays.flow).toBe(0.2);
  });

  it.each(STAR_MODES.filter(mode => mode.id !== "rays"))("moves $id toward the camera and grows its perspective projection", ({ id, defaults }) => {
    const f = fixture();
    const settings = { ...defaults, density: 1, flow: 1, parallax: 0, spread: 0, curvature: 0, turbulence: 0, gravity: 0, trail: 0 };
    const motion = createStarMotion(f.positions, f.opacity, f.sizes, 716, settings, id);
    motion.update(0, true, f.group, f.view, true);
    const original = f.positions.slice(); const alpha = f.opacity.slice();
    motion.update(0.1, true, f.group, f.view);
    let approaching = 0;
    for (let i = 0; i < f.opacity.length; i++) {
      if (alpha[i] < 0.3) continue;
      const before = new THREE.Vector3().fromArray(original, i * 3).applyMatrix4(f.group.matrixWorld);
      const after = new THREE.Vector3().fromArray(f.positions, i * 3).applyMatrix4(f.group.matrixWorld);
      const beforeCamera = before.clone().applyMatrix4(f.view.camera.matrixWorldInverse);
      const afterCamera = after.clone().applyMatrix4(f.view.camera.matrixWorldInverse);
      if (beforeCamera.z > -2 || afterCamera.z > -1.5) continue;
      expect(afterCamera.z).toBeGreaterThan(beforeCamera.z);
      before.project(f.view.camera); after.project(f.view.camera);
      expect(Math.hypot(after.x, after.y + 0.024)).toBeGreaterThan(Math.hypot(before.x, before.y + 0.024));
      approaching++;
    }
    expect(approaching).toBeGreaterThan(20);
  });

  it.each(STAR_MODES.filter(mode => mode.id !== "rays"))("lets $id pass the lens without bright near-plane artifacts", ({ id, defaults }) => {
    const f = fixture();
    const motion = createStarMotion(f.positions, f.opacity, f.sizes, 716, { ...defaults, density: 1, flow: 2 }, id);
    motion.update(0, true, f.group, f.view, true);
    let crossed = false;
    const point = new THREE.Vector3();
    for (let frame = 0; frame < 240; frame++) {
      motion.update(0.1, true, f.group, f.view);
      for (let i = 0; i < f.opacity.length; i++) {
        point.fromArray(f.positions, i * 3).applyMatrix4(f.group.matrixWorld).applyMatrix4(f.view.camera.matrixWorldInverse);
        if (point.z > 0) crossed = true;
        if (point.z > -0.249) expect(f.opacity[i]).toBe(0);
      }
    }
    expect(crossed).toBe(true);
  });
});
