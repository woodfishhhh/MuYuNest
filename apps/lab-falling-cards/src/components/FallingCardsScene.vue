<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as THREE from "three";
import { generateCards, type CardSpec } from "../composables/cards";
import { VARIANTS, type VariantConfig } from "../playground/variants";

const props = defineProps<{ variant?: VariantConfig }>();
let currentVariant: VariantConfig =
  props.variant ?? VARIANTS.find((v) => v.id === "v15") ?? VARIANTS[0];

// ─── Constants ──────────────────────────────────────────────────────────────
const CAMERA_Z = 7;
const GRAVITY = 0.55;
const FAR_Z = -26;
const PASS_Z = CAMERA_Z + 1.5;
const BOTTOM_Y = -5.5;
const CARD_W = 1.35;
const CARD_H = 1.8;
const CARD_D = 0.04;
const GRAB_DISTANCE = 5.0;
const GRAB_LERP = 16;
const SPAWN_INTERVAL = 1.2; // seconds between new cards
const POOL_SIZE = 12;

// ─── Friend card data ────────────────────────────────────────────────────────
const FRIEND_CARDS = [
  {
    name: "木鱼的博客",
    domain: "woodfish.site",
    desc: "在代码与文字之间寻找意义，记录每一个值得铭记的瞬间。",
    avatarHue: 220,
  },
  {
    name: "Three.js 世界",
    domain: "threejs.org",
    desc: "用 WebGL 的语言构建三维世界，让浏览器里也有无限空间。",
    avatarHue: 40,
  },
  {
    name: "Pinia 状态库",
    domain: "pinia.vuejs.org",
    desc: "轻量直觉的 Vue 状态管理，组合式 API 的绝佳拍档。",
    avatarHue: 340,
  },
  {
    name: "Nuxt 框架",
    domain: "nuxt.com",
    desc: "全栈 Vue 应用的首选平台，从 SPA 到 SSR 都得心应手。",
    avatarHue: 140,
  },
  {
    name: "GSAP 动画",
    domain: "gsap.com",
    desc: "专业级网页动画解决方案，时间轴掌控一切。",
    avatarHue: 100,
  },
  {
    name: "Vite 构建",
    domain: "vite.dev",
    desc: "下一代前端开发与构建工具，极速冷启动，即时热更新。",
    avatarHue: 280,
  },
  {
    name: "Tailwind CSS",
    domain: "tailwindcss.com",
    desc: "实用优先的 CSS 框架，直接在标记里构建任何设计。",
    avatarHue: 200,
  },
  {
    name: "TypeScript",
    domain: "typescriptlang.org",
    desc: "带类型系统的 JavaScript 超集，让大型代码库也井然有序。",
    avatarHue: 215,
  },
];

const CN_STACK =
  '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",system-ui,sans-serif';

// ─── Reactive state (for template) ──────────────────────────────────────────

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isHovering = ref(false);
const isGrabbing = ref(false);

// ─── Three.js engine state ──────────────────────────────────────────────────

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let raf = 0;
let lastTime = 0;
let clockStart = 0;
let lastSpawnAt = 0;

// ─── Card interfaces ─────────────────────────────────────────────────────────

interface FallingCard {
  spec: CardSpec;
  mesh: THREE.Mesh;
  materials: THREE.MeshBasicMaterial[];
  textures: THREE.CanvasTexture[];
  active: boolean;
  grabbed: boolean;
  // physics
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  finalSize: number;
  // lifecycle
  bornAt: number;
  fadeIn: number;
}

const pool: FallingCard[] = [];
const activeCards: FallingCard[] = [];

// ─── Grab interaction state ──────────────────────────────────────────────────

const _raycaster = new THREE.Raycaster();
const _targetGrabPos = new THREE.Vector3();
const _prevPointerNDC = new THREE.Vector2();
const _curPointerNDC = new THREE.Vector2();
const _throwVelocity = new THREE.Vector2();

let grabbedCard: FallingCard | null = null;

// ─── Canvas helpers ──────────────────────────────────────────────────────────

function rrPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapCJKText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines = 3,
): void {
  let line = "";
  let curY = y;
  let lines = 0;
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, curY);
      line = ch;
      curY += lineH;
      lines++;
      if (lines >= maxLines) return;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, curY);
}

// ─── Card texture: Friend card front ────────────────────────────────────────

function makeFriendCardFront(spec: CardSpec): HTMLCanvasElement {
  const W = 480;
  const H = 640;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const friend = FRIEND_CARDS[spec.index % FRIEND_CARDS.length];
  const R = 28; // corner radius
  const pal = currentVariant.palette;
  const baseHue = (spec.hue + pal.cardBgHueShift) % 360;

  // ── Background: tinted paper from palette ─
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, `hsl(${baseHue}, ${pal.cardSat}%, ${Math.min(99, pal.cardLight + 2)}%)`);
  bg.addColorStop(1, `hsl(${baseHue}, ${pal.cardSat - 2}%, ${pal.cardLight - 4}%)`);
  ctx.fillStyle = bg;
  rrPath(ctx, 0, 0, W, H, R);
  ctx.fill();

  // ── Border ─
  ctx.strokeStyle = pal.cardBorder;
  ctx.lineWidth = 2.5;
  rrPath(ctx, 1.25, 1.25, W - 2.5, H - 2.5, R);
  ctx.stroke();

  // ── Pin dot (top-center) ─
  const pinX = W / 2;
  const pinY = 24;
  // outer halo
  ctx.beginPath();
  ctx.arc(pinX, pinY, 13, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${spec.hue}, 38%, 55%, 0.18)`;
  ctx.fill();
  // pin body
  ctx.beginPath();
  ctx.arc(pinX, pinY, 8, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${spec.hue}, 50%, 52%, 0.72)`;
  ctx.fill();
  // pin highlight
  ctx.beginPath();
  ctx.arc(pinX - 2, pinY - 2, 3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fill();

  // ── Avatar circle ─
  const avatarX = 72;
  const avatarY = 116;
  const avatarR = 46;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
  ctx.clip();
  // avatar background gradient
  const avatarGrad = ctx.createRadialGradient(
    avatarX - 10,
    avatarY - 10,
    4,
    avatarX,
    avatarY,
    avatarR,
  );
  avatarGrad.addColorStop(0, `hsl(${friend.avatarHue}, 65%, 72%)`);
  avatarGrad.addColorStop(1, `hsl(${friend.avatarHue}, 55%, 52%)`);
  ctx.fillStyle = avatarGrad;
  ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
  ctx.restore();
  // avatar border
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // avatar initial
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `700 38px ${CN_STACK}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(friend.name[0], avatarX, avatarY + 1);

  // ── Name ─
  ctx.fillStyle = pal.cardTextDark;
  ctx.font = `700 38px ${CN_STACK}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  // Truncate if too long
  let displayName = friend.name;
  while (
    ctx.measureText(displayName).width > W - 160 &&
    displayName.length > 1
  ) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== friend.name) displayName += "…";
  ctx.fillText(displayName, 138, 82);

  // ── Domain ─
  ctx.fillStyle = pal.cardTextSoft;
  ctx.font = `400 24px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textBaseline = "top";
  ctx.fillText(friend.domain, 140, 130);

  // ── Divider ─
  ctx.strokeStyle = pal.cardBorder;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(36, 182);
  ctx.lineTo(W - 36, 182);
  ctx.stroke();

  // ── Description ─
  ctx.fillStyle = pal.cardTextSoft;
  ctx.font = `400 27px ${CN_STACK}`;
  ctx.textBaseline = "top";
  wrapCJKText(ctx, friend.desc, 36, 208, W - 72, 44, 4);

  // ── Corner glare overlay (top-left highlight) ─
  const glare = ctx.createLinearGradient(0, 0, W * 0.65, H * 0.55);
  glare.addColorStop(0, "rgba(255,255,255,0.30)");
  glare.addColorStop(0.4, "rgba(255,255,255,0.10)");
  glare.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  rrPath(ctx, 0, 0, W, H, R);
  ctx.fill();

  return c;
}

// ─── Card texture: back ──────────────────────────────────────────────────────

function makeFriendCardBack(spec: CardSpec): HTMLCanvasElement {
  const W = 480;
  const H = 640;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const R = 28;
  const pal = currentVariant.palette;
  const baseHue = (spec.hue + pal.cardBgHueShift) % 360;

  // Slightly deeper paper from palette
  ctx.fillStyle = `hsl(${baseHue}, ${Math.max(4, pal.cardSat - 4)}%, ${pal.cardLight - 6}%)`;
  rrPath(ctx, 0, 0, W, H, R);
  ctx.fill();

  // Border
  ctx.strokeStyle = `hsla(${spec.hue}, 22%, 42%, 0.18)`;
  ctx.lineWidth = 2.5;
  rrPath(ctx, 1.25, 1.25, W - 2.5, H - 2.5, R);
  ctx.stroke();

  // Watermark 友
  ctx.fillStyle = `hsla(${spec.hue}, 32%, 38%, 0.10)`;
  ctx.font = `900 300px ${CN_STACK}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("友", W / 2, H / 2);

  return c;
}

// ─── Mesh factory ────────────────────────────────────────────────────────────

function makeCardMesh(spec: CardSpec): {
  mesh: THREE.Mesh;
  materials: THREE.MeshBasicMaterial[];
  textures: THREE.CanvasTexture[];
} {
  const frontTex = new THREE.CanvasTexture(makeFriendCardFront(spec));
  frontTex.colorSpace = THREE.SRGBColorSpace;
  frontTex.anisotropy = 8;
  frontTex.generateMipmaps = true;

  const backTex = new THREE.CanvasTexture(makeFriendCardBack(spec));
  backTex.colorSpace = THREE.SRGBColorSpace;
  backTex.anisotropy = 4;

  const frontMat = new THREE.MeshBasicMaterial({
    map: frontTex,
    transparent: true,
    opacity: 1,
  });
  const backMat = new THREE.MeshBasicMaterial({
    map: backTex,
    transparent: true,
    opacity: 1,
  });
  const mkSide = () =>
    new THREE.MeshBasicMaterial({
      color: 0xe8ddd0,
      transparent: true,
      opacity: 1,
    });

  const materials: THREE.MeshBasicMaterial[] = [
    mkSide(),
    mkSide(),
    mkSide(),
    mkSide(),
    frontMat,
    backMat,
  ];
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D),
    materials,
  );
  return { mesh, materials, textures: [frontTex, backTex] };
}

// ─── Background: switchable per variant ────────────────────────────────────

function addLineSegs(scn: THREE.Scene, positions: number[]): void {
  if (positions.length === 0) return;
  const pal = currentVariant.palette;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: pal.line,
    transparent: true,
    opacity: pal.lineOpacity,
  });
  scn.add(new THREE.LineSegments(geo, mat));
}

function addPoints(
  scn: THREE.Scene,
  positions: number[],
  size = 0.05,
  opacity = 0.5,
): void {
  if (positions.length === 0) return;
  const pal = currentVariant.palette;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: pal.line,
    size,
    transparent: true,
    opacity: pal.lineOpacity * opacity * 2,
    sizeAttenuation: true,
  });
  scn.add(new THREE.Points(geo, mat));
}

function buildBackground(scn: THREE.Scene) {
  const bg = currentVariant.bg;
  const CEIL_Y = 5.0;
  const FLOOR_Y = -5.0;
  const Z_NEAR = CAMERA_Z + 4;
  const Z_FAR = FAR_Z - 5;
  const X_SPAN = 22;

  if (bg === "void") return;

  if (bg === "minimal-horizon") {
    // 单一地平线 + 远端两条极浅参考线
    const segs: number[] = [];
    segs.push(-X_SPAN, FLOOR_Y, Z_FAR + 6, X_SPAN, FLOOR_Y, Z_FAR + 6);
    segs.push(-X_SPAN, FLOOR_Y, Z_FAR + 18, X_SPAN, FLOOR_Y, Z_FAR + 18);
    addLineSegs(scn, segs);
    return;
  }

  if (bg === "subtle-frame") {
    const segs: number[] = [];
    segs.push(-X_SPAN, CEIL_Y, Z_FAR, X_SPAN, CEIL_Y, Z_FAR);
    segs.push(-X_SPAN, FLOOR_Y, Z_FAR, X_SPAN, FLOOR_Y, Z_FAR);
    segs.push(-X_SPAN, CEIL_Y, Z_NEAR, X_SPAN, CEIL_Y, Z_NEAR);
    segs.push(-X_SPAN, FLOOR_Y, Z_NEAR, X_SPAN, FLOOR_Y, Z_NEAR);
    addLineSegs(scn, segs);
    return;
  }

  if (bg === "floor-only") {
    const segs: number[] = [];
    const X_STEP = 4.0;
    const Z_STEP = 4.0;
    for (let z = Z_FAR; z <= Z_NEAR; z += Z_STEP) {
      segs.push(-X_SPAN, FLOOR_Y, z, X_SPAN, FLOOR_Y, z);
    }
    for (let x = -X_SPAN; x <= X_SPAN; x += X_STEP) {
      segs.push(x, FLOOR_Y, Z_FAR, x, FLOOR_Y, Z_NEAR);
    }
    addLineSegs(scn, segs);
    return;
  }

  if (bg === "soft-grid") {
    const segs: number[] = [];
    const X_STEP = 4.0;
    const Z_STEP = 4.0;
    for (let z = Z_FAR; z <= Z_NEAR; z += Z_STEP) {
      segs.push(-X_SPAN, CEIL_Y, z, X_SPAN, CEIL_Y, z);
      segs.push(-X_SPAN, FLOOR_Y, z, X_SPAN, FLOOR_Y, z);
    }
    for (let x = -X_SPAN; x <= X_SPAN; x += X_STEP) {
      segs.push(x, CEIL_Y, Z_FAR, x, CEIL_Y, Z_NEAR);
      segs.push(x, FLOOR_Y, Z_FAR, x, FLOOR_Y, Z_NEAR);
    }
    addLineSegs(scn, segs);
    return;
  }

  if (bg === "dot-field") {
    const positions: number[] = [];
    const STEP = 2.2;
    for (let z = Z_FAR; z <= Z_NEAR; z += STEP) {
      for (let x = -X_SPAN; x <= X_SPAN; x += STEP) {
        positions.push(x, FLOOR_Y, z);
      }
    }
    addPoints(scn, positions, 0.06, 0.55);
    return;
  }

  if (bg === "vertical-stripes") {
    const segs: number[] = [];
    const xs = [-X_SPAN, -X_SPAN / 2, 0, X_SPAN / 2, X_SPAN];
    for (const x of xs) {
      segs.push(x, FLOOR_Y, Z_FAR + 4, x, CEIL_Y, Z_FAR + 4);
    }
    // 加一条地平线让画面不空
    segs.push(-X_SPAN, FLOOR_Y, Z_FAR + 6, X_SPAN, FLOOR_Y, Z_FAR + 6);
    addLineSegs(scn, segs);
    return;
  }

  if (bg === "concentric") {
    const segs: number[] = [];
    const SEGS_PER_CIRCLE = 64;
    for (let r = 4; r <= 26; r += 4) {
      for (let i = 0; i < SEGS_PER_CIRCLE; i++) {
        const a1 = (i / SEGS_PER_CIRCLE) * Math.PI * 2;
        const a2 = ((i + 1) / SEGS_PER_CIRCLE) * Math.PI * 2;
        segs.push(
          Math.cos(a1) * r,
          FLOOR_Y,
          Math.sin(a1) * r - 8,
          Math.cos(a2) * r,
          FLOOR_Y,
          Math.sin(a2) * r - 8,
        );
      }
    }
    addLineSegs(scn, segs);
    return;
  }
}

// ─── Card lifecycle ───────────────────────────────────────────────────────────

function spawnCard(card: FallingCard, now: number): void {
  // Born above and far, falls down toward camera (仰视 natural path)
  card.mesh.position.set(
    (Math.random() - 0.5) * 3.0,
    3.2 + Math.random() * 1.8, // high up
    FAR_Z + Math.random() * 4.0,
  );
  card.mesh.rotation.set(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    (Math.random() - 0.5) * 1.2,
  );

  card.vx = (Math.random() - 0.5) * 1.5;
  card.vy = -1.2 - Math.random() * 1.5; // already falling faster
  card.vz = 4.5 + Math.random() * 2.5; // forward faster

  card.spinX = (Math.random() - 0.5) * 2.0;
  card.spinY = (Math.random() - 0.5) * 1.5;
  card.spinZ = (Math.random() - 0.5) * 1.0;

  card.finalSize = 0.88 + Math.random() * 0.28;
  card.mesh.scale.setScalar(card.finalSize);
  card.bornAt = now;
  card.fadeIn = 0.5;
  card.active = true;
  card.grabbed = false;
  card.mesh.visible = true;
}

function recycleCard(card: FallingCard): void {
  card.active = false;
  card.grabbed = false;
  card.mesh.visible = false;
  const idx = activeCards.indexOf(card);
  if (idx !== -1) activeCards.splice(idx, 1);
  pool.push(card);
}

function updateCard(card: FallingCard, now: number, dt: number): void {
  const scaleTarget = card.grabbed ? card.finalSize * 1.38 : card.finalSize;
  const currentScale = card.mesh.scale.x;
  card.mesh.scale.setScalar(
    currentScale + (scaleTarget - currentScale) * (1 - Math.exp(-dt * 10)),
  );

  if (card.grabbed) {
    // Lerp card position toward grab target
    card.mesh.position.lerp(_targetGrabPos, 1 - Math.exp(-dt * GRAB_LERP));
    // Gentle idle spin while held
    card.mesh.rotation.y += card.spinY * 0.18 * dt;
    card.mesh.rotation.z += card.spinZ * 0.12 * dt;
    // Always fully opaque while grabbed
    for (const m of card.materials) m.opacity = 1;
    return;
  }

  // Normal physics
  card.vy -= GRAVITY * dt;
  card.mesh.position.x += card.vx * dt;
  card.mesh.position.y += card.vy * dt;
  card.mesh.position.z += card.vz * dt;
  card.mesh.rotation.x += card.spinX * dt;
  card.mesh.rotation.y += card.spinY * dt;
  card.mesh.rotation.z += card.spinZ * dt;

  // Opacity
  let opacity = 1;
  const age = now - card.bornAt;
  if (age < card.fadeIn) opacity = age / card.fadeIn;
  const z = card.mesh.position.z;
  const y = card.mesh.position.y;
  const FADE_Z = 1.8;
  const FADE_Y = 1.4;
  if (z > PASS_Z - FADE_Z)
    opacity = Math.min(opacity, Math.max(0, (PASS_Z - z) / FADE_Z));
  if (y < BOTTOM_Y + FADE_Y)
    opacity = Math.min(opacity, Math.max(0, (y - BOTTOM_Y) / FADE_Y));
  for (const m of card.materials) {
    if (m.opacity !== opacity) m.opacity = opacity;
  }

  if (z > PASS_Z || y < BOTTOM_Y) recycleCard(card);
}

// ─── Scene initialisation ─────────────────────────────────────────────────────

function applyCameraPreset(): void {
  if (!camera) return;
  switch (currentVariant.camera) {
    case "eye-level":
      camera.position.set(0, -2.0, CAMERA_Z);
      camera.lookAt(0, -2.0, 0);
      break;
    case "slight-low":
      camera.position.set(0, -2.8, CAMERA_Z);
      camera.lookAt(0, -1.6, -2);
      break;
    case "slight-high":
      camera.position.set(0, 1.0, CAMERA_Z);
      camera.lookAt(0, -1.2, -2);
      break;
    case "isometric":
      camera.position.set(3.5, 2.5, CAMERA_Z);
      camera.lookAt(0, -0.5, -2);
      break;
  }
}

function initScene(): void {
  if (!canvasRef.value) return;
  const pal = currentVariant.palette;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(pal.bg);
  scene.fog = new THREE.Fog(new THREE.Color(pal.fog), pal.fogNear, pal.fogFar);

  camera = new THREE.PerspectiveCamera(
    68,
    window.innerWidth / window.innerHeight,
    0.1,
    120,
  );
  applyCameraPreset();

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  clockStart = performance.now() / 1000;
  lastSpawnAt = clockStart - SPAWN_INTERVAL; // allow immediate first card

  buildBackground(scene);

  // Pre-build the card pool (all invisible initially)
  const specs = generateCards(POOL_SIZE);
  for (const spec of specs) {
    const { mesh, materials, textures } = makeCardMesh(spec);
    mesh.visible = false;
    scene.add(mesh);
    pool.push({
      spec,
      mesh,
      materials,
      textures,
      active: false,
      grabbed: false,
      vx: 0,
      vy: 0,
      vz: 0,
      spinX: 0,
      spinY: 0,
      spinZ: 0,
      finalSize: 1,
      bornAt: 0,
      fadeIn: 0.5,
    });
  }

  window.addEventListener("resize", handleResize);
}

function handleResize(): void {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ─── Pointer interaction (Works-style grab) ───────────────────────────────────

function ndcFromEvent(e: PointerEvent): THREE.Vector2 {
  return new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  );
}

function updateGrabTarget(ndc: THREE.Vector2): void {
  if (!camera) return;
  _raycaster.setFromCamera(ndc, camera);
  _targetGrabPos
    .copy(_raycaster.ray.origin)
    .addScaledVector(_raycaster.ray.direction, GRAB_DISTANCE);
}

function pickCard(ndc: THREE.Vector2): FallingCard | null {
  if (!camera) return null;
  _raycaster.setFromCamera(ndc, camera);
  const meshes = activeCards.map((c) => c.mesh);
  const hits = _raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  return activeCards.find((c) => c.mesh === hits[0].object) ?? null;
}

function onPointerDown(e: PointerEvent): void {
  const ndc = ndcFromEvent(e);
  const card = pickCard(ndc);
  if (!card) return;

  grabbedCard = card;
  card.grabbed = true;
  _prevPointerNDC.copy(ndc);
  _curPointerNDC.copy(ndc);
  _throwVelocity.set(0, 0);
  updateGrabTarget(ndc);
  isGrabbing.value = true;
  (e.target as Element).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent): void {
  const ndc = ndcFromEvent(e);
  _prevPointerNDC.copy(_curPointerNDC);
  _curPointerNDC.copy(ndc);

  if (grabbedCard) {
    // accumulate throw velocity (exponential moving average)
    const dv = _curPointerNDC.clone().sub(_prevPointerNDC);
    _throwVelocity.lerp(dv, 0.6);
    updateGrabTarget(ndc);
  } else {
    // hover detection
    isHovering.value = pickCard(ndc) !== null;
  }
}

function onPointerUp(e: PointerEvent): void {
  if (!grabbedCard) return;

  const card = grabbedCard;
  card.grabbed = false;

  // Convert 2-D throw into 3-D card velocity impulse
  const throwStrength = 5.5;
  const aspect = window.innerWidth / window.innerHeight;
  card.vx += _throwVelocity.x * throwStrength * aspect;
  card.vy += _throwVelocity.y * throwStrength;
  // Keep the card moving forward (don't let it go backwards)
  if (card.vz < 1.5) card.vz = 1.5;

  grabbedCard = null;
  isGrabbing.value = false;
  isHovering.value = false;
  _throwVelocity.set(0, 0);
  (e.target as Element).releasePointerCapture(e.pointerId);
}

// ─── Render loop ──────────────────────────────────────────────────────────────

function tick(rafNow: number): void {
  const dt = lastTime === 0 ? 0 : Math.min(0.05, (rafNow - lastTime) / 1000);
  lastTime = rafNow;
  const now = rafNow / 1000;

  // Spawn one card every SPAWN_INTERVAL seconds
  if (pool.length > 0 && now - lastSpawnAt >= SPAWN_INTERVAL) {
    const card = pool.pop()!;
    spawnCard(card, now);
    activeCards.push(card);
    lastSpawnAt = now;
  }

  // Update all active cards (copy array since recycling mutates activeCards)
  for (const card of activeCards.slice()) {
    updateCard(card, now, dt);
  }

  if (renderer && scene && camera) renderer.render(scene, camera);
  raf = requestAnimationFrame(tick);
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  initScene();
  if (canvasRef.value) {
    canvasRef.value.addEventListener("pointerdown", onPointerDown);
    canvasRef.value.addEventListener("pointermove", onPointerMove);
    canvasRef.value.addEventListener("pointerup", onPointerUp);
  }
  raf = requestAnimationFrame(tick);
});

function teardownScene(): void {
  const allCards = [...activeCards, ...pool];
  for (const card of allCards) {
    if (card.mesh.geometry) card.mesh.geometry.dispose();
    for (const t of card.textures) t.dispose();
    for (const m of card.materials) m.dispose();
  }
  renderer?.dispose();
  renderer = null;
  scene = null;
  camera = null;
  activeCards.length = 0;
  pool.length = 0;
  grabbedCard = null;
}

watch(
  () => props.variant,
  (next) => {
    if (!next || next === currentVariant) return;
    currentVariant = next;
    cancelAnimationFrame(raf);
    teardownScene();
    initScene();
    raf = requestAnimationFrame(tick);
  },
);

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  if (canvasRef.value) {
    canvasRef.value.removeEventListener("pointerdown", onPointerDown);
    canvasRef.value.removeEventListener("pointermove", onPointerMove);
    canvasRef.value.removeEventListener("pointerup", onPointerUp);
  }
  window.removeEventListener("resize", handleResize);
  teardownScene();
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="canvas"
    :class="{
      'cursor-grab': isHovering && !isGrabbing,
      'cursor-grabbing': isGrabbing,
    }"
  />
</template>

<style scoped>
.canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: block;
  touch-action: none;
}

.cursor-grab {
  cursor: grab;
}

.cursor-grabbing {
  cursor: grabbing;
}
</style>
