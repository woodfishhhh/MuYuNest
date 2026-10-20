import * as THREE from "three";
import { seededRandom } from "@/components/scene/home-card-flight/motion";
import type { StarClockView } from "@/composables/star-clock";
import { bunchRadius, type PlaygroundSettings, type StarMode } from "./star-clusters";

const TAU = Math.PI * 2;
const fract = (value: number) => THREE.MathUtils.euclideanModulo(value, 1);

// Only the playground uses these motions; Home keeps its selected star-clock settings.
export function createStarMotion(
  positions: Float32Array,
  opacity: Float32Array,
  sizes: Float32Array,
  seed: number,
  initial: PlaygroundSettings,
  initialMode: StarMode,
) {
  const original = positions.slice();
  const transitionFrom = positions.slice();
  const transitionAlpha = opacity.slice();
  const transitionSizes = sizes.slice();
  const originalAlpha = opacity.slice();
  const originalSizes = sizes.slice();
  const point = new THREE.Vector3();
  const cameraToLocal = new THREE.Matrix4();
  let settings = { ...initial };
  let mode = initialMode;
  let progress = 0;
  let transition = 1;
  let time = 0;
  let particles: { phase: number; width: number; radius: number; angle: number; size: number }[] = [];
  let groups: { phase: number; lane: number; depth: number }[] = [];

  function reseed() {
    const random = seededRandom(seed);
    groups = Array.from({ length: 36 }, () => ({ phase: random(), lane: random(), depth: random() }));
    particles = Array.from({ length: opacity.length }, () => ({
      phase: random(), width: (random() + random() + random() - 1.5) * 1.5,
      radius: random(), angle: random() * TAU, size: 0.65 + random() * 0.7,
    }));
  }
  reseed();

  function configure(next: PlaygroundSettings, nextMode = mode, nextSeed = seed) {
    if (nextMode !== mode) {
      transitionFrom.set(positions); transitionAlpha.set(opacity); transitionSizes.set(sizes);
      transition = 0;
    }
    mode = nextMode; settings = { ...next };
    if (nextSeed !== seed) { seed = nextSeed; reseed(); }
  }

  function update(delta: number, active: boolean, group: THREE.Group, view: StarClockView, immediate = false) {
    const dt = Math.min(delta, 0.1);
    if (!immediate) time += dt * settings.flow;
    progress = immediate ? Number(active) : THREE.MathUtils.clamp(progress + (active ? dt : -dt) / 0.8, 0, 1);
    transition = immediate ? 1 : Math.min(1, transition + dt / 0.7);
    const blend = THREE.MathUtils.smoothstep(progress, 0, 1);
    const morph = THREE.MathUtils.smoothstep(transition, 0, 1);
    view.camera.updateMatrixWorld(); group.updateMatrixWorld(true);
    cameraToLocal.copy(group.matrixWorld).invert().multiply(view.camera.matrixWorld);
    const tan = Math.tan(THREE.MathUtils.degToRad(view.camera.fov / 2));
    const { width, height } = view;
    const scale = Math.min(width, height) / 800;
    const selected = Math.floor(opacity.length * settings.density);
    const direction = THREE.MathUtils.degToRad(settings.angle);

    for (let index = 0; index < opacity.length; index++) {
      const offset = index * 3;
      let alpha = originalAlpha[index];
      let size = originalSizes[index];
      point.fromArray(original, offset);
      // Spread selected points throughout the source field, so density changes keep its balance.
      if (Math.floor(index * selected / opacity.length) !== Math.floor((index + 1) * selected / opacity.length)) {
        const p = particles[index];
        const lane = Math.floor(index * selected / opacity.length) % settings.count;
        const g = groups[lane];
        let x = 0; let y = 0; let depth = 16;
        let brightness = 1; let pointSize = p.size;

        if (mode === "rays") {
          const phase = fract(p.phase + time * 0.09);
          const radial = phase / (4 - phase * 3);
          const bunched = bunchRadius(radial, settings.bunches, settings.clumping, g.phase * TAU);
          const angle = lane * TAU / settings.count + direction;
          const bend = settings.curvature * 0.7 * radial * radial;
          const rayX = Math.sin(angle); const rayY = -Math.cos(angle);
          const edge = Math.min(width / 2 / Math.max(1e-6, Math.abs(rayX)), height / 2 / Math.max(1e-6, Math.abs(rayY)));
          const radius = 40 * scale + bunched * (edge + 60) * settings.reach;
          const lateral = p.width * settings.spread * (2 + radial * 28) * scale;
          x = width / 2 + Math.sin(angle + bend) * radius + Math.cos(angle + bend) * lateral;
          y = height * 0.512 - Math.cos(angle + bend) * radius + Math.sin(angle + bend) * lateral;
          depth = 24 - phase * 18;
          brightness = THREE.MathUtils.smoothstep(phase, 0, 0.03) * (1 - THREE.MathUtils.smoothstep(phase, 0.95, 1)) * (0.45 + radial * 0.5);
        } else if (mode === "comet") {
          const phase = fract(g.phase + time * 0.075 * (0.85 + g.depth * 0.3));
          const tail = Math.pow(p.phase, 1.55);
          const azimuth = lane * TAU / settings.count + direction + (g.lane - 0.5) * 0.5;
          const radius = 1.2 + g.lane * 5.8;
          const bend = settings.curvature * tail * tail * 0.9;
          const drift = Math.sin(tail * 8 + g.phase * TAU + time * 0.7) * settings.turbulence * tail * 0.3;
          const lateral = p.width * settings.spread * (0.02 + tail * 0.16) + bend + drift;
          // The head advances along camera Z. Tail particles remain farther away,
          // so perspective stretches the tail back toward the vanishing point.
          x = (Math.sin(azimuth) * radius + Math.cos(azimuth) * lateral) * view.camera.aspect;
          y = Math.cos(azimuth) * radius - Math.sin(azimuth) * lateral;
          depth = 42 - phase * 54 + tail * settings.trail * 18;
          brightness = (0.16 + Math.pow(1 - tail, 1.5) * 0.84) * THREE.MathUtils.smoothstep(phase, 0, 0.04) * (1 - THREE.MathUtils.smoothstep(phase, 0.96, 1));
          pointSize *= 0.65 + Math.pow(1 - tail, 16) * 3.2;
        } else {
          const phase = fract(g.phase + time * 0.055 * (0.75 + g.depth * 0.3));
          const approach = Math.pow(phase, 1 + settings.gravity * 0.5);
          const radius = Math.pow(p.radius, 0.5 + settings.clumping * 2) * settings.spread * 1.25;
          const azimuth = lane * TAU / settings.count + direction + (g.lane - 0.5) * 0.4;
          const sway = Math.sin(phase * TAU + g.phase * 12) * settings.turbulence * 0.45 * (0.2 + approach);
          const distance = 1.2 + g.lane * 7 + sway;
          x = (Math.sin(azimuth) * distance + Math.cos(p.angle) * radius) * view.camera.aspect;
          y = Math.cos(azimuth) * distance + Math.sin(p.angle) * radius;
          // A whole volume crosses the camera plane; its screen radius and star
          // sizes grow naturally as depth decreases, with acceleration along Z.
          depth = 48 - approach * 62 + p.phase * p.phase * settings.trail * 14 + Math.sin(p.angle) * radius * 0.7;
          brightness = THREE.MathUtils.smoothstep(phase, 0, 0.06) * (1 - THREE.MathUtils.smoothstep(phase, 0.94, 1)) * (0.4 + (1 - p.radius) * 0.6);
          pointSize *= 0.7 + (1 - p.radius) * 0.8;
        }

        if (mode === "rays") {
          if (!immediate) {
            const parallax = settings.parallax * (26 - depth) / 18;
            x += view.pointer.x * 22 * parallax;
            y -= view.pointer.y * 18 * parallax;
          }
          point.set((x * 2 / width - 1) * tan * depth * view.camera.aspect,
            (1 - y * 2 / height) * tan * depth, -depth);
        } else {
          if (!immediate) {
            x += view.pointer.x * settings.parallax * 0.35;
            y += view.pointer.y * settings.parallax * 0.3;
          }
          brightness *= THREE.MathUtils.smoothstep(depth, 0.25, 1.5);
          point.set(x, y - 0.024 * tan * depth, -depth);
        }
        point.applyMatrix4(cameraToLocal);
        point.x = THREE.MathUtils.lerp(original[offset], point.x, blend);
        point.y = THREE.MathUtils.lerp(original[offset + 1], point.y, blend);
        point.z = THREE.MathUtils.lerp(original[offset + 2], point.z, blend);
        alpha = THREE.MathUtils.lerp(alpha, brightness, blend);
        size = THREE.MathUtils.lerp(size, pointSize * settings.starSize, blend);
      } else {
        alpha = THREE.MathUtils.lerp(alpha, 0.22, blend);
        size = THREE.MathUtils.lerp(size, 0.75, blend);
      }
      positions[offset] = THREE.MathUtils.lerp(transitionFrom[offset], point.x, morph);
      positions[offset + 1] = THREE.MathUtils.lerp(transitionFrom[offset + 1], point.y, morph);
      positions[offset + 2] = THREE.MathUtils.lerp(transitionFrom[offset + 2], point.z, morph);
      opacity[index] = THREE.MathUtils.lerp(transitionAlpha[index], alpha, morph);
      sizes[index] = THREE.MathUtils.lerp(transitionSizes[index], size, morph);
    }
    return true;
  }

  function replay() {
    time = 0; progress = 0; transition = 1;
    positions.set(original); opacity.set(originalAlpha); sizes.set(originalSizes);
  }
  return { configure, update, replay };
}
