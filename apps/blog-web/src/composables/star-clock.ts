import * as THREE from "three";

export const STAR_CLOCK_RAYS = 12;
export const STAR_CLOCK_SHARE = 0.24;
const TURN = Math.PI * 2;
const DURATION = 1.25;

export interface StarClockView {
  camera: THREE.PerspectiveCamera;
  width: number;
  height: number;
  pointer: THREE.Vector2;
}

// Reposition a subset of the existing points. No extra stars or line meshes.
export function createStarClock(positions: Float32Array, opacity: Float32Array) {
  const count = positions.length / 3;
  const selectedCount = Math.floor(count * STAR_CLOCK_SHARE / STAR_CLOCK_RAYS) * STAR_CLOCK_RAYS;
  const perRay = selectedCount / STAR_CLOCK_RAYS;
  const slots = Array.from({ length: selectedCount }, (_, i) => ({
    index: Math.floor((i + 0.5) * count / selectedCount), ray: 0, phase: 0, angle: 0, radius: 0,
  }));
  const selected = new Set(slots.map(slot => slot.index));
  const originals = new Float32Array(positions.length);
  const point = new THREE.Vector3();
  const cameraToLocal = new THREE.Matrix4();
  let active = false;
  let reducedMotion = false;
  let captured = false;
  let progress = 0;
  let time = 0;

  function setActive(value: boolean, reduced = false) { active = value; reducedMotion = reduced; }

  function capture(group: THREE.Group, view: StarClockView) {
    originals.set(positions);
    // Sort by screen angle, then distance: nearby stars gather into the same spoke.
    for (const slot of slots) {
      point.fromArray(positions, slot.index * 3).applyMatrix4(group.matrixWorld).project(view.camera);
      const x = point.x * view.width / 2;
      const y = -(point.y + 0.024) * view.height / 2;
      slot.angle = THREE.MathUtils.euclideanModulo(Math.atan2(x, -y) + Math.PI / 12, TURN);
      slot.radius = Math.hypot(x, y);
    }
    slots.sort((a, b) => a.angle - b.angle);
    for (let ray = 0; ray < STAR_CLOCK_RAYS; ray++) {
      const ordered = slots.slice(ray * perRay, (ray + 1) * perRay).sort((a, b) => a.radius - b.radius);
      ordered.forEach((slot, rank) => { slot.ray = ray; slot.phase = (rank + 0.5) / perRay; });
    }
    captured = true;
    time = 0;
  }

  // Preserve the original depth animation for the selected stars while morphed.
  function sourceFor(index: number) { return captured && selected.has(index) ? originals : positions; }

  function update(delta: number, group: THREE.Group, view?: StarClockView, flowSpeed = 1) {
    if (!view || !selectedCount || (!active && !captured)) return false;
    view.camera.updateMatrixWorld();
    group.updateMatrixWorld(true);
    if (!captured) capture(group, view);
    const step = Math.min(delta, 0.1) / DURATION;
    progress = reducedMotion ? Number(active) : THREE.MathUtils.clamp(progress + (active ? step : -step), 0, 1);
    if (progress === 0) {
      for (const { index } of slots) {
        positions.set(originals.subarray(index * 3, index * 3 + 3), index * 3);
        opacity[index] = 1;
      }
      captured = false;
      return true;
    }
    if (!reducedMotion) time += Math.min(delta, 0.1) * 0.09 * flowSpeed;
    const blend = THREE.MathUtils.smoothstep(progress, 0, 1);
    cameraToLocal.copy(group.matrixWorld).invert().multiply(view.camera.matrixWorld);
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(view.camera.fov / 2));
    const centerY = view.height * 0.512; // Same vanishing point as the Home geometry/cards.
    const innerRadius = (view.width > 767 ? 144 : 112) * 0.38;
    for (const slot of slots) {
      const phase = (slot.phase + time) % 1;
      const radial = phase / (4 - phase * 3);
      const angle = slot.ray * TURN / STAR_CLOCK_RAYS;
      const dx = Math.sin(angle);
      const dy = -Math.cos(angle);
      const edgeX = Math.abs(dx) < 1e-6 ? Infinity : view.width / 2 / Math.abs(dx);
      const edgeY = Math.abs(dy) < 1e-6 ? Infinity : (dy < 0 ? centerY : view.height - centerY) / Math.abs(dy);
      const radius = innerRadius + radial * (Math.min(edgeX, edgeY) + 80 - innerRadius);
      const depth = 24 - phase * 18;
      const parallaxX = reducedMotion ? 0 : view.pointer.x * 18 * radial;
      const parallaxY = reducedMotion ? 0 : -view.pointer.y * 14 * radial;
      const x = dx * radius + parallaxX;
      const y = centerY + dy * radius + parallaxY;
      point.set(x * 2 / view.width * tanHalfFov * depth * view.camera.aspect,
        (1 - y * 2 / view.height) * tanHalfFov * depth, -depth).applyMatrix4(cameraToLocal);
      const offset = slot.index * 3;
      positions[offset] = THREE.MathUtils.lerp(originals[offset], point.x, blend);
      positions[offset + 1] = THREE.MathUtils.lerp(originals[offset + 1], point.y, blend);
      positions[offset + 2] = THREE.MathUtils.lerp(originals[offset + 2], point.z, blend);
      const fade = THREE.MathUtils.smoothstep(phase, 0, 0.04) * (1 - THREE.MathUtils.smoothstep(phase, 0.94, 1));
      opacity[slot.index] = THREE.MathUtils.lerp(1, fade * (0.4 + radial * 0.5), blend);
    }
    return true;
  }

  return { setActive, update, sourceFor };
}
