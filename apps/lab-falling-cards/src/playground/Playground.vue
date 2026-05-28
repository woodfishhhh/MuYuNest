<script setup lang="ts">
import { VARIANTS, type VariantConfig, type BgPattern } from "./variants";

defineEmits<{ (e: "select", v: VariantConfig): void }>();

// SVG mockup helpers — render a tiny perspective preview per bg pattern.
const W = 240;
const H = 150;
const FLOOR_Y = 108;
const CEIL_Y = 24;
const VX = W / 2;
const VY = 66; // vanishing point

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Project a point at given x ∈ [-1,1] (left/right edge), y row (ceil/floor) at depth t (0=near, 1=far).
function proj(side: -1 | 0 | 1, y: number, t: number): [number, number] {
  // perspective: at t=0 edges are at outer; at t=1 they collapse to vanishing point
  const edgeX = side === 0 ? VX : side === -1 ? 0 : W;
  const px = lerp(edgeX, VX, t);
  const py = lerp(y, VY, t);
  return [px, py];
}

interface RenderedLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
interface RenderedDot {
  cx: number;
  cy: number;
  r: number;
}

function buildSvg(pattern: BgPattern): {
  lines: RenderedLine[];
  dots: RenderedDot[];
} {
  const lines: RenderedLine[] = [];
  const dots: RenderedDot[] = [];

  if (pattern === "void") {
    return { lines, dots };
  }

  if (pattern === "minimal-horizon") {
    const [x1, y1] = proj(-1, FLOOR_Y, 0.55);
    const [x2, y2] = proj(1, FLOOR_Y, 0.55);
    lines.push({ x1, y1, x2, y2 });
    return { lines, dots };
  }

  if (pattern === "subtle-frame") {
    // ceiling + floor lines near and mid
    for (const t of [0.15, 0.55]) {
      let p = proj(-1, FLOOR_Y, t);
      let q = proj(1, FLOOR_Y, t);
      lines.push({ x1: p[0], y1: p[1], x2: q[0], y2: q[1] });
      p = proj(-1, CEIL_Y, t);
      q = proj(1, CEIL_Y, t);
      lines.push({ x1: p[0], y1: p[1], x2: q[0], y2: q[1] });
    }
    return { lines, dots };
  }

  if (pattern === "floor-only" || pattern === "soft-grid") {
    // horizontal floor rungs
    const ts = [0.15, 0.32, 0.5, 0.65, 0.78];
    for (const t of ts) {
      const [x1, y1] = proj(-1, FLOOR_Y, t);
      const [x2, y2] = proj(1, FLOOR_Y, t);
      lines.push({ x1, y1, x2, y2 });
    }
    // longitudinal floor lines
    for (const s of [-1, -0.5, 0, 0.5, 1] as const) {
      const side = s as -1 | 0 | 1;
      const sx = s === -1 ? 0 : s === 1 ? W : VX + s * (W / 2);
      const [, yNear] = proj(side, FLOOR_Y, 0);
      lines.push({ x1: sx, y1: yNear, x2: VX, y2: VY });
    }
    if (pattern === "soft-grid") {
      // mirror ceiling
      for (const t of ts) {
        const [x1, y1] = proj(-1, CEIL_Y, t);
        const [x2, y2] = proj(1, CEIL_Y, t);
        lines.push({ x1, y1, x2, y2 });
      }
      for (const s of [-1, -0.5, 0, 0.5, 1] as const) {
        const sx = s === -1 ? 0 : s === 1 ? W : VX + s * (W / 2);
        const [, yNear] = proj(s as -1 | 0 | 1, CEIL_Y, 0);
        lines.push({ x1: sx, y1: yNear, x2: VX, y2: VY });
      }
    }
    return { lines, dots };
  }

  if (pattern === "dot-field") {
    for (let row = 0; row < 6; row++) {
      const t = 0.1 + row * 0.13;
      const cols = 9 - row;
      for (let col = 0; col < cols; col++) {
        const side = (col - (cols - 1) / 2) / ((cols - 1) / 2 || 1);
        const sx =
          side <= -1
            ? 0
            : side >= 1
              ? W
              : VX + side * (W / 2);
        const [px, py] = (() => {
          const [, yNear] = proj(0, FLOOR_Y, t);
          const x = lerp(sx, VX, t);
          return [x, yNear];
        })();
        dots.push({ cx: px, cy: py, r: 1.2 });
      }
    }
    return { lines, dots };
  }

  if (pattern === "vertical-stripes") {
    const t = 0.62;
    for (const s of [-1, -0.5, 0, 0.5, 1] as const) {
      const sx = s === -1 ? 0 : s === 1 ? W : VX + s * (W / 2);
      const [x1, y1] = (() => {
        const x = lerp(sx, VX, t);
        return [x, lerp(FLOOR_Y, VY, t)];
      })();
      const [x2, y2] = [x1, lerp(CEIL_Y, VY, t)];
      lines.push({ x1, y1, x2, y2 });
    }
    // ground line
    const [hx1, hy1] = proj(-1, FLOOR_Y, 0.55);
    const [hx2, hy2] = proj(1, FLOOR_Y, 0.55);
    lines.push({ x1: hx1, y1: hy1, x2: hx2, y2: hy2 });
    return { lines, dots };
  }

  if (pattern === "concentric") {
    // draw a few flattened ellipses centered at vanishing point
    for (let i = 1; i <= 4; i++) {
      const rx = 18 * i;
      const ry = 5 * i;
      const SEGS = 36;
      let prev: [number, number] | null = null;
      for (let k = 0; k <= SEGS; k++) {
        const a = (k / SEGS) * Math.PI * 2;
        const x = VX + Math.cos(a) * rx;
        const y = FLOOR_Y - 8 + Math.sin(a) * ry * 0.6;
        if (prev) lines.push({ x1: prev[0], y1: prev[1], x2: x, y2: y });
        prev = [x, y];
      }
    }
    return { lines, dots };
  }

  return { lines, dots };
}

function lineHexToCss(n: number, alpha: number): string {
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
</script>

<template>
  <div class="playground">
    <header class="hero">
      <div class="hero-eyebrow">Falling Cards · Playground</div>
      <h1 class="hero-title">挑一个你最喜欢的风格</h1>
      <p class="hero-sub">
        16 个组合（4 色板 × 多视角 × 多背景），点击任意一个进入实景。
      </p>
    </header>

    <div class="grid">
      <button
        v-for="v in VARIANTS"
        :key="v.id"
        type="button"
        class="cell"
        :style="{ '--cell-bg': v.palette.bg }"
        @click="$emit('select', v)"
      >
        <div class="thumb">
          <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
            <rect
              x="0"
              y="0"
              :width="W"
              :height="H"
              :fill="v.palette.bg"
            />
            <g
              :stroke="lineHexToCss(v.palette.line, v.palette.lineOpacity)"
              stroke-width="0.7"
              fill="none"
            >
              <line
                v-for="(ln, i) in buildSvg(v.bg).lines"
                :key="`l-${i}`"
                :x1="ln.x1"
                :y1="ln.y1"
                :x2="ln.x2"
                :y2="ln.y2"
              />
            </g>
            <g :fill="lineHexToCss(v.palette.line, v.palette.lineOpacity * 1.6)">
              <circle
                v-for="(d, i) in buildSvg(v.bg).dots"
                :key="`d-${i}`"
                :cx="d.cx"
                :cy="d.cy"
                :r="d.r"
              />
            </g>
            <!-- mock card -->
            <rect
              x="100"
              y="58"
              width="40"
              height="54"
              rx="5"
              :fill="`hsl(${(20 + v.palette.cardBgHueShift) % 360}, ${v.palette.cardSat}%, ${v.palette.cardLight}%)`"
              :stroke="v.palette.cardBorder"
              stroke-width="0.6"
            />
          </svg>
        </div>
        <div class="meta">
          <div class="meta-top">
            <span class="code">{{ v.id }}</span>
            <span class="name">{{ v.name }}</span>
          </div>
          <p class="desc">{{ v.desc }}</p>
        </div>
      </button>
    </div>

    <footer class="foot">
      Pick one · 你也可以随时返回切换
    </footer>
  </div>
</template>

<style scoped>
.playground {
  min-height: 100vh;
  width: 100vw;
  background: #f4f2ea;
  color: #1c1410;
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "PingFang SC",
    "Noto Sans CJK SC",
    sans-serif;
  padding: 64px clamp(24px, 6vw, 96px) 96px;
  box-sizing: border-box;
}

.hero {
  max-width: 1200px;
  margin: 0 auto 56px;
}

.hero-eyebrow {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(28, 20, 16, 0.46);
  margin-bottom: 18px;
}

.hero-title {
  font-size: clamp(28px, 4vw, 44px);
  font-weight: 500;
  letter-spacing: -0.01em;
  margin: 0 0 12px;
}

.hero-sub {
  font-size: 15px;
  color: rgba(28, 20, 16, 0.6);
  margin: 0;
  max-width: 520px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 780px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.cell {
  background: #ffffff;
  border: 1px solid rgba(28, 20, 16, 0.08);
  border-radius: 14px;
  padding: 0;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font: inherit;
  color: inherit;
}

.cell:hover {
  transform: translateY(-2px);
  border-color: rgba(28, 20, 16, 0.2);
  box-shadow: 0 14px 30px -16px rgba(20, 14, 8, 0.18);
}

.cell:focus-visible {
  outline: 2px solid #1c1410;
  outline-offset: 2px;
}

.thumb {
  width: 100%;
  aspect-ratio: 240 / 150;
  background: var(--cell-bg);
  border-bottom: 1px solid rgba(28, 20, 16, 0.05);
}

.thumb svg {
  width: 100%;
  height: 100%;
  display: block;
}

.meta {
  padding: 14px 16px 16px;
}

.meta-top {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
}

.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: rgba(28, 20, 16, 0.4);
  letter-spacing: 0.05em;
}

.name {
  font-size: 14px;
  font-weight: 500;
  color: #1c1410;
}

.desc {
  font-size: 12.5px;
  color: rgba(28, 20, 16, 0.55);
  margin: 0;
  line-height: 1.5;
}

.foot {
  margin-top: 56px;
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(28, 20, 16, 0.35);
}
</style>
