import * as THREE from "three";
import { seededRandom } from "@/components/scene/home-card-flight/motion";
import type { StarClockView } from "@/composables/star-clock";
import { bunchRadius, type ClusterSettings } from "./star-clusters";
import { matchNearbyStars } from "./star-transition";

export type StarMode = "rays" | "comet" | "fall";
export interface StarMotionSettings extends ClusterSettings {
  count: number;
  density: number;
  starSize: number;
  reach: number;
  trail: number;
  angle: number;
  gravity: number;
  turbulence: number;
}

const TAU = Math.PI * 2;
const fract = (value: number) => THREE.MathUtils.euclideanModulo(value, 1);

// Home and the playground share the same projection, timing and particle selection.
export function createStarMotion(
  positions: Float32Array,
  opacity: Float32Array,
  sizes: Float32Array,
  seed: number,
  initial: StarMotionSettings,
  initialMode: StarMode,
) {
  const original = positions.slice();
  const transitionFrom = positions.slice();
  const transitionAlpha = opacity.slice();
  const transitionSizes = sizes.slice();
  const originalAlpha = opacity.slice();
  const originalSizes = sizes.slice();
  const targets = positions.slice();
  const targetAlpha = opacity.slice();
  const targetSizes = sizes.slice();
  const fromScreen = new Float32Array(opacity.length * 2);
  const toScreen = new Float32Array(opacity.length * 2);
  const fromDepth = new Float32Array(opacity.length);
  const point = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const cameraToLocal = new THREE.Matrix4();
  const localToCamera = new THREE.Matrix4();
  let settings = { ...initial };
  let mode = initialMode;
  let activeState = false;
  let transition = 1;
  let pendingMatch = false;
  let assignment: Int32Array = Int32Array.from({ length: opacity.length }, (_, index) => index);
  let nearby: Uint8Array = new Uint8Array(opacity.length).fill(1);
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

  function beginTransition() {
    transitionFrom.set(positions); transitionAlpha.set(opacity); transitionSizes.set(sizes);
    transition = 0; pendingMatch = true;
  }

  function configure(next: StarMotionSettings, nextMode = mode, nextSeed = seed) {
    if (nextMode !== mode || nextSeed !== seed || next.count !== settings.count || next.density !== settings.density) beginTransition();
    mode = nextMode; settings = { ...next };
    if (nextSeed !== seed) { seed = nextSeed; reseed(); }
  }

  function update(delta: number, active: boolean, group: THREE.Group, view: StarClockView, immediate = false) {
    const dt = Math.min(delta, 0.1);
    if (active !== activeState) { beginTransition(); activeState = active; }
    // Let the local handover finish before starting the new mode's depth motion.
    if (!immediate && transition === 1 && active) time += dt * settings.flow;
    if (immediate) {
      transition = 1; pendingMatch = false;
      for (let index = 0; index < assignment.length; index++) assignment[index] = index;
    }
    view.camera.updateMatrixWorld(); group.updateMatrixWorld(true);
    cameraToLocal.copy(group.matrixWorld).invert().multiply(view.camera.matrixWorld);
    localToCamera.copy(view.camera.matrixWorldInverse).multiply(group.matrixWorld);
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
      if (active && Math.floor(index * selected / opacity.length) !== Math.floor((index + 1) * selected / opacity.length)) {
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
        alpha = brightness;
        size = pointSize * settings.starSize;
      } else if (active) {
        alpha = 0.22;
        size = 0.75;
      }
      targets[offset] = point.x; targets[offset + 1] = point.y; targets[offset + 2] = point.z;
      targetAlpha[index] = alpha; targetSizes[index] = size;
    }

    if (pendingMatch) {
      for (const [array, alpha, screen] of [[transitionFrom, transitionAlpha, fromScreen], [targets, targetAlpha, toScreen]] as const) {
        screen.fill(NaN);
        for (let index = 0; index < alpha.length; index++) {
          if (alpha[index] < 0.1) continue;
          projected.fromArray(array, index * 3).applyMatrix4(localToCamera);
          if (projected.z >= -0.25) continue;
          if (array === transitionFrom) fromDepth[index] = -projected.z;
          const x = projected.x / (-projected.z * tan * view.camera.aspect) * width / 2 + width / 2;
          const y = (1 - projected.y / (-projected.z * tan)) * height / 2;
          if (x < -32 || x > width + 32 || y < -32 || y > height + 32) continue;
          screen[index * 2] = x; screen[index * 2 + 1] = y;
        }
      }
      const match = matchNearbyStars(fromScreen, toScreen, Math.max(48, Math.min(110, Math.min(width, height) * 0.13)));
      assignment = match.targetForSource; nearby = match.nearby; pendingMatch = false;
    }
    transition = immediate ? 1 : Math.min(1, transition + dt / 0.8);
    const morph = THREE.MathUtils.smoothstep(transition, 0, 1);
    if (morph === 0) {
      positions.set(transitionFrom); opacity.set(transitionAlpha); sizes.set(transitionSizes);
      return true;
    }
    for (let index = 0; index < opacity.length; index++) {
      const offset = index * 3;
      const target = assignment[index]; const destination = target * 3;
      if (transition === 1) {
        positions[offset] = targets[destination];
        positions[offset + 1] = targets[destination + 1];
        positions[offset + 2] = targets[destination + 2];
        opacity[index] = targetAlpha[target];
      } else if (nearby[index]) {
        projected.fromArray(targets, destination).applyMatrix4(localToCamera);
        const targetDepth = -projected.z;
        const x = projected.x / (targetDepth * tan * view.camera.aspect) * width / 2 + width / 2;
        const y = (1 - projected.y / (targetDepth * tan)) * height / 2;
        const screenX = THREE.MathUtils.lerp(fromScreen[index * 2], x, morph);
        const screenY = THREE.MathUtils.lerp(fromScreen[index * 2 + 1], y, morph);
        const depth = 1 / THREE.MathUtils.lerp(1 / fromDepth[index], 1 / targetDepth, morph);
        point.set((screenX * 2 / width - 1) * tan * depth * view.camera.aspect,
          (1 - screenY * 2 / height) * tan * depth, -depth).applyMatrix4(cameraToLocal);
        positions[offset] = point.x; positions[offset + 1] = point.y; positions[offset + 2] = point.z;
        opacity[index] = THREE.MathUtils.lerp(transitionAlpha[index], targetAlpha[target], morph);
      } else {
        const before = transition < 0.5;
        const array = before ? transitionFrom : targets;
        const source = before ? offset : destination;
        positions[offset] = array[source]; positions[offset + 1] = array[source + 1]; positions[offset + 2] = array[source + 2];
        opacity[index] = before
          ? transitionAlpha[index] * (1 - THREE.MathUtils.smoothstep(transition, 0, 0.5))
          : targetAlpha[target] * THREE.MathUtils.smoothstep(transition, 0.5, 1);
      }
      sizes[index] = THREE.MathUtils.lerp(transitionSizes[index], targetSizes[target], morph);
    }
    if (!active && transition === 1) {
      // Reindex the same final point cloud without changing its visible layout.
      positions.set(original); opacity.set(originalAlpha); sizes.set(originalSizes);
    }
    return true;
  }

  function replay() {
    time = 0; activeState = false; transition = 1; pendingMatch = false;
    positions.set(original); opacity.set(originalAlpha); sizes.set(originalSizes);
  }
  return { configure, update, replay, sourceFor: (_index: number) => original, isActive: () => activeState || transition < 1 };
}
