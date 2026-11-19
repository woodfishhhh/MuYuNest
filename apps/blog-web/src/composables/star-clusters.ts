import * as THREE from "three";
import { seededRandom } from "@/components/scene/home-card-flight/motion";
import { createStarClock, type StarClockView } from "./star-clock";

export interface ClusterSettings {
  bunches: number;
  spread: number;
  clumping: number;
  curvature: number;
  flow: number;
  parallax: number;
}

export const LEGACY_STAR_SETTINGS: ClusterSettings = { bunches: 8, spread: 1, clumping: 0.05, curvature: 1, flow: 0.25, parallax: 1 };
export const ORIGINAL_STAR_SETTINGS: ClusterSettings = { bunches: 4, spread: 0, clumping: 0, curvature: 0, flow: 1, parallax: 1 };

// Compress spacing along an existing line, preserving endpoints and star order.
export function bunchRadius(radial: number, bunches: number, strength: number, phase: number) {
  const frequency = Math.PI * 2 * bunches;
  return radial - (Math.sin(frequency * radial + phase) - Math.sin(phase)) * strength * 0.92 / frequency;
}

export function createStarClusters(positions: Float32Array, opacity: Float32Array, sizes: Float32Array, seed: number, initial: ClusterSettings) {
  const original = positions.slice();
  const baseline = positions.slice();
  const baselineOpacity = opacity.slice();
  let clock = createStarClock(baseline, baselineOpacity);
  let settings = { ...initial };
  let progress = 0;
  let engaged = false;
  let noise: { width: number; size: number }[] = [];
  let phases: number[] = [];
  const point = new THREE.Vector3();
  const localToCamera = new THREE.Matrix4();
  const cameraToLocal = new THREE.Matrix4();
  const scaledPointer = new THREE.Vector2();

  function configure(next: ClusterSettings, nextSeed = seed) {
    settings = { ...next }; seed = nextSeed;
    const random = seededRandom(seed);
    phases = Array.from({ length: 12 }, () => random() * Math.PI * 2);
    noise = Array.from({ length: positions.length / 3 }, () => ({
      width: (random() + random() + random() - 1.5) * 1.5,
      size: 0.7 + random() * 0.7,
    }));
  }
  configure(initial);

  function update(delta: number, active: boolean, group: THREE.Group, view: StarClockView, immediate = false) {
    if (!engaged && !active) return false;
    if (!engaged) {
      original.set(positions); baseline.set(positions); baselineOpacity.set(opacity);
      clock = createStarClock(baseline, baselineOpacity); engaged = true;
    }
    const dt = Math.min(delta, 0.1);
    progress = immediate ? Number(active) : THREE.MathUtils.clamp(progress + (active ? dt : -dt) / 1.25, 0, 1);
    scaledPointer.copy(view.pointer).multiplyScalar(settings.parallax);
    clock.setActive(active, immediate);
    clock.update(dt, group, { ...view, pointer: scaledPointer }, settings.flow);
    positions.set(baseline); opacity.set(baselineOpacity); sizes.fill(1);
    if (progress === 0) { engaged = false; return true; }
    // The reference uses the original Home clock without deformation.
    if (!settings.spread && !settings.clumping && !settings.curvature) return true;
    const blend = Math.pow(THREE.MathUtils.smoothstep(progress, 0, 1), 3);
    localToCamera.copy(view.camera.matrixWorldInverse).multiply(group.matrixWorld);
    cameraToLocal.copy(localToCamera).invert();
    const tan = Math.tan(THREE.MathUtils.degToRad(view.camera.fov / 2));
    const cy = view.height * 0.512;
    const inner = (view.width > 767 ? 144 : 112) * 0.38;
    const scale = Math.max(0.55, Math.min(view.width, view.height) / 900);
    const style = Math.max(settings.spread, settings.clumping, settings.curvature);
    for (let index = 0; index < opacity.length; index++) {
      if (baselineOpacity[index] === 1) continue;
      const offset = index * 3;
      point.fromArray(baseline, offset).applyMatrix4(localToCamera);
      const depth = -point.z;
      const x = point.x / (tan * depth * view.camera.aspect) * view.width / 2;
      const y = (1 - point.y / (tan * depth)) * view.height / 2 - cy;
      const phase = THREE.MathUtils.clamp((24 - depth) / 18, 0, 1);
      const radial = phase / (4 - phase * 3);
      const angle = Math.atan2(x, -y);
      const ray = Math.round(THREE.MathUtils.euclideanModulo(angle, Math.PI * 2) / (Math.PI / 6)) % 12;
      const dx = Math.sin(angle); const dy = -Math.cos(angle);
      const edgeX = view.width / 2 / Math.max(0.00001, Math.abs(dx));
      const edgeY = (dy < 0 ? cy : view.height - cy) / Math.max(0.00001, Math.abs(dy));
      const length = Math.min(edgeX, edgeY) + 80 - inner;
      const bunched = bunchRadius(radial, settings.bunches, settings.clumping, phases[ray]);
      const radius = Math.hypot(x, y) + (bunched - radial) * length;
      const bend = settings.curvature * 0.12 * radial * (Math.sin(radial * Math.PI * 1.25 + phases[ray]) - Math.sin(phases[ray]));
      const direction = angle + bend;
      const lateral = noise[index].width * settings.spread * (2 + radial * 24) * scale;
      const targetX = Math.sin(direction) * radius + Math.cos(direction) * lateral;
      const targetY = -Math.cos(direction) * radius + Math.sin(direction) * lateral;
      point.set(targetX * 2 / view.width * tan * depth * view.camera.aspect,
        (1 - (targetY + cy) * 2 / view.height) * tan * depth, -depth).applyMatrix4(cameraToLocal);
      positions[offset] = THREE.MathUtils.lerp(baseline[offset], point.x, blend);
      positions[offset + 1] = THREE.MathUtils.lerp(baseline[offset + 1], point.y, blend);
      positions[offset + 2] = THREE.MathUtils.lerp(baseline[offset + 2], point.z, blend);
      sizes[index] = THREE.MathUtils.lerp(1, noise[index].size, blend * style);
    }
    return true;
  }
  function sourceFor(index: number) { return engaged ? clock.sourceFor(index) : positions; }
  function replay() {
    progress = 0; engaged = false;
    positions.set(original); baseline.set(original); opacity.fill(1); baselineOpacity.fill(1); sizes.fill(1);
    clock = createStarClock(baseline, baselineOpacity);
  }
  return { configure, update, replay, sourceFor };
}
