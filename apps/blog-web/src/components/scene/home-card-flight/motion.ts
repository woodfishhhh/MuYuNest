// Parameters measured from wodniack.dev's s-my-way section (2026-10-18).
// Simulation uses original CSS pixel coordinates, Y down, and a fixed 60 Hz tick.
export const STEP = 1 / 60;
export const PERSPECTIVE = 1000;
export const MAX_ACTIVE = 2;
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

  constructor(public index: number) {}

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
      this.vx += (target.x - this.x) * 0.075;
      this.vy += (target.y - this.y) * 0.075;
      this.vz += -this.z * 0.3;
      // Restore v2's spring/response; only reduce its angular gain by 10%.
      this.ry = this.vx * 0.135;
      this.rx = this.vy * -0.135;
      this.rz = this.ry + this.rx;
      this.vx *= 0.9; this.vy *= 0.9; this.vz *= 0.75;
      this.x += this.vx * 0.5;
      this.y += this.vy * 0.5;
      this.z = Math.min(this.z + this.vz * 0.25, 500);
      this.s += (1 - this.s) * 0.5;
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
