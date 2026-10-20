// Parameters measured from wodniack.dev's s-my-way section (2026-10-18).
// Simulation uses original CSS pixel coordinates, Y down, and a fixed 60 Hz tick.
import { Euler, MathUtils, Quaternion } from "three";

export const STEP = 1 / 60;
export const PERSPECTIVE = 1000;
export const MAX_ACTIVE = 2;
export const CARD_PICKUP_DURATION = 0.72;
export type Layout = ReturnType<typeof layoutFor>;

export function layoutFor(width: number, height: number) {
  let padding = 640;
  if (width <= 1680) padding = 560;
  if (width <= 1530) padding = 480;
  if (width <= 1280) padding = 400;
  if (width <= 987) padding = 480;
  if (width <= 767) padding = 400;
  if (width <= 576 || (width <= 767 && width > height)) padding = 288;
  const compact = width <= 987;
  const sectionHeight = padding * (compact ? 2 : 2.25) + 90;
  const smileX = width / 2;
  const smileY = height * 0.512;
  const sectionTop = smileY - padding * 0.75 - 45;
  const originY = sectionTop + sectionHeight / 2;
  const perspectiveY = originY - padding * (compact ? 0.275 : 0.4);
  return { width, height, padding, sectionHeight, sectionTop, smileX, smileY,
    originY, perspectiveY, cardWidth: width > 767 ? 500 : 300 };
}

export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Flight {
  x = 0; y = 0; z = -20000;
  rx = 90; ry = 0; rz = 0; s = 0; size = 1;
  vx = 0; vy = 0; vz = 45; vrx = 0; vry = 0;
  state: 'waiting' | 'flying' | 'dragging' | 'vanishing' = 'waiting';
  vanishAge = 0;
  private pickupAge = 0;
  private pickup = { screenX: 0, screenY: 0, magnification: 1, scale: 1, perspectiveOffset: 0 };
  private pickupRotation = new Quaternion();
  private rotation = new Quaternion();
  private targetRotation = new Quaternion();
  private euler = new Euler(0, 0, 0, "XYZ");

  constructor(public index: number) {}

  beginPickup(perspectiveOffset = 0) {
    const magnification = PERSPECTIVE / (PERSPECTIVE - this.z);
    this.pickup = {
      screenX: this.x * magnification,
      screenY: this.y * magnification + perspectiveOffset * (1 - magnification),
      magnification, scale: this.s, perspectiveOffset,
    };
    this.pickupAge = 0;
    this.euler.set(-MathUtils.degToRad(this.rx), MathUtils.degToRad(this.ry), -MathUtils.degToRad(this.rz));
    this.pickupRotation.setFromEuler(this.euler);
    this.rotation.copy(this.pickupRotation);
    this.vx = this.vy = this.vz = 0;
    this.state = "dragging";
  }

  reset(layout: Layout, random: () => number, warm = false) {
    this.size = 0.5 + random() * 0.5;
    this.x = this.y = this.rz = this.s = 0;
    this.z = -20000;
    this.rx = 90;
    this.ry = random() * 2 - 1;
    this.vz = 40 + random() * 10;
    this.vx = random() * layout.width * 0.0025 * (this.index % 2 ? -1 : 1);
    this.vy = random() * layout.height * 0.0025 * (this.index % 3 ? -1 : 1);
    this.vrx = 0.25 + random();
    this.vry = 0.25 + random();
    this.state = 'flying';
    this.vanishAge = 0;
    if (warm) {
      this.s = 1;
      this.x = this.vx * random() * 200;
      this.y = this.vy * random() * 200;
      this.rx = random() * 360;
      this.ry = random() * 360;
      this.z = random() * -20000;
    }
  }

  tick(target?: { x: number; y: number }, flightSpeed = 1) {
    if (this.state === 'waiting') return;
    if (this.state === 'dragging' && target) {
      const previousX = this.x; const previousY = this.y;
      const pickingUp = this.pickupAge < CARD_PICKUP_DURATION;
      this.pickupAge = Math.min(CARD_PICKUP_DURATION, this.pickupAge + STEP);
      const progress = MathUtils.smoothstep(this.pickupAge / CARD_PICKUP_DURATION, 0, 1);
      if (pickingUp) {
        // Ease visible magnification rather than raw Z: a far card should not
        // spend most of pickup tiny and then jump into the viewer's face.
        const magnification = MathUtils.lerp(this.pickup.magnification, 1, progress);
        this.z = PERSPECTIVE * (1 - 1 / magnification);
        this.x = MathUtils.lerp(this.pickup.screenX, target.x, progress) / magnification;
        const screenY = MathUtils.lerp(this.pickup.screenY, target.y, progress);
        this.y = (screenY - this.pickup.perspectiveOffset * (1 - magnification)) / magnification;
        this.s = MathUtils.lerp(this.pickup.scale, 1, progress);
        this.targetRotation.identity();
        this.rotation.slerpQuaternions(this.pickupRotation, this.targetRotation, progress);
      } else {
        this.z = 0; this.s = 1;
        this.x += (target.x - this.x) * (1 - Math.exp(-12 * STEP));
        this.y += (target.y - this.y) * (1 - Math.exp(-12 * STEP));
        const tiltX = MathUtils.clamp((this.y - previousY) * -0.135, -6, 6);
        const tiltY = MathUtils.clamp((this.x - previousX) * 0.135, -6, 6);
        this.euler.set(-MathUtils.degToRad(tiltX), MathUtils.degToRad(tiltY), -MathUtils.degToRad((tiltX + tiltY) * 0.25));
        this.targetRotation.setFromEuler(this.euler);
        this.rotation.slerp(this.targetRotation, 1 - Math.exp(-12 * STEP));
      }
      this.euler.setFromQuaternion(this.rotation, "XYZ");
      this.rx = -MathUtils.radToDeg(this.euler.x);
      this.ry = MathUtils.radToDeg(this.euler.y);
      this.rz = -MathUtils.radToDeg(this.euler.z);
      this.vx = this.x - previousX; this.vy = this.y - previousY;
    } else if (this.state === 'vanishing') {
      this.vy += 0.5;
      this.x += this.vx; this.y += this.vy;
      this.rx += this.vrx; this.ry += this.vry;
      this.vanishAge += STEP;
      if (this.vanishAge > 1) this.state = 'waiting';
    } else if (this.state === 'flying') {
      if (this.z > 1000) { this.state = 'waiting'; return; }
      this.s = Math.min(this.s + 0.005 * flightSpeed, 1);
      this.z += this.vz * flightSpeed;
      this.x += this.vx * flightSpeed; this.y += this.vy * flightSpeed;
      this.rx += this.vrx * flightSpeed; this.ry += this.vry * flightSpeed;
    }
  }
}
