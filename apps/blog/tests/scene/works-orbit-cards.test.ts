import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { WORKS_WEBGL_GLASS_PROFILE } from "@/components/home/works/works-card-preset";
import {
  createWorksOrbitCardFrame,
  createWorksOrbitCards,
  getWorksCaseGridSlot,
  getWorksCenterMagnetStrength,
  getWorksOrbitRadii,
  isWorksLaunchZone,
  resolveWorksCaseGridLayout,
  WORKS_ORBIT_CARD_RENDER_LAYER,
  WORKS_ORBIT_CARD_SIZE,
} from "@/components/scene/works-orbit-cards";

const originalGetContextDescriptor = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  "getContext",
);

const works = [
  {
    slug: "blog",
    name: "WoodFishNest",
    description: "Three.js powered immersive blog hub.",
    kind: "Blog",
    avatarUrl: "/site-icons/woodfish.svg",
    liveUrl: "https://blog.woodfish.site/",
    githubUrl: "https://github.com/woodfishhhh/VueThreeBlog",
  },
  {
    slug: "weather",
    name: "WeatherDemo",
    description: "Monochrome weather workspace and forecast explorer.",
    kind: "App",
    avatarUrl: "/site-icons/weather.svg",
    liveUrl: "https://weather.woodfish.site/",
    githubUrl: "https://github.com/woodfishhhh/WeatherDemo",
  },
];

function mockCanvasContext() {
  const gradient = {
    addColorStop: vi.fn(),
  };
  const context = {
    beginPath: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 12 })),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
  };

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => context),
  });

  return context;
}

function createCamera() {
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

function updateOrbitCards(
  cards: ReturnType<typeof createWorksOrbitCards>,
  camera: THREE.PerspectiveCamera,
  elapsed: number,
  delta: number,
) {
  cards.update({
    camera,
    center: new THREE.Vector3(0, 0, 0),
    delta,
    elapsed,
    layout: "orbit",
    reducedMotion: true,
    viewport: {
      height: 900,
      width: 1440,
    },
    visible: true,
  });
}

describe("createWorksOrbitCardFrame", () => {
  beforeEach(() => {
    mockCanvasContext();
  });

  afterEach(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: originalGetContextDescriptor?.configurable ?? true,
      value: originalGetContextDescriptor?.value,
      writable: originalGetContextDescriptor?.writable,
    });
    vi.restoreAllMocks();
  });

  it("places work cards around a 3D orbit center", () => {
    const frames = [0, 1, 2].map((index) =>
      createWorksOrbitCardFrame({
        center: { x: 0, y: 0, z: 0 },
        count: 3,
        elapsed: 0,
        index,
        radiusX: 6,
        radiusY: 1.4,
        radiusZ: 2.5,
      }),
    );

    expect(frames).toHaveLength(3);
    expect(new Set(frames.map((frame) => frame.position.x))).toHaveLength(3);
    expect(new Set(frames.map((frame) => frame.position.z))).toHaveLength(3);
  });

  it("uses depth to scale down front cards while keeping them opaque", () => {
    const frames = [0, 1, 2].map((index) =>
      createWorksOrbitCardFrame({
        count: 3,
        elapsed: 1,
        index,
      }),
    );
    const front = [...frames].sort((a, b) => b.depth - a.depth)[0];
    const back = [...frames].sort((a, b) => a.depth - b.depth)[0];

    expect(front.scale).toBeLessThan(back.scale);
    expect(front.opacity).toBe(1);
    expect(back.opacity).toBe(1);
    expect(front.position.z).toBeGreaterThan(back.position.z);
  });

  it("freezes motion when reduced motion is requested", () => {
    expect(
      createWorksOrbitCardFrame({
        count: 3,
        elapsed: 0,
        index: 1,
        reducedMotion: true,
      }),
    ).toEqual(
      createWorksOrbitCardFrame({
        count: 3,
        elapsed: 20,
        index: 1,
        reducedMotion: true,
      }),
    );
  });

  it("uses the expanded desktop orbit radii", () => {
    expect(getWorksOrbitRadii(800)).toEqual({
      radiusX: 6.2,
      radiusY: 2.1,
      radiusZ: 6.2,
    });

    const wide = getWorksOrbitRadii(1440);
    expect(wide.radiusX).toBeCloseTo(1440 / 160);
    expect(wide.radiusY).toBeCloseTo(1440 / 600);
    expect(wide.radiusZ).toBeCloseTo(1440 / 190);
    expect(wide.radiusX / wide.radiusY).toBeGreaterThan(3.5);
    expect(wide.radiusZ).toBeGreaterThan(wide.radiusY);
  });

  it("uses a smaller Orbit-only card plane while preserving the Case aspect ratio", () => {
    expect(WORKS_ORBIT_CARD_SIZE.width).toBeCloseTo(3.08);
    expect(WORKS_ORBIT_CARD_SIZE.height).toBeCloseTo(2.065);
    expect(WORKS_ORBIT_CARD_SIZE.width / WORKS_ORBIT_CARD_SIZE.height).toBeCloseTo(352 / 236);
  });

  it("centers the Case layout as a responsive two-column grid", () => {
    const viewport = { height: 900, width: 1440 };
    const slots = [0, 1, 2, 3].map((index) => getWorksCaseGridSlot(index, 4, viewport));

    expect(slots.every((slot) => slot.width === 352 && slot.height === 236)).toBe(true);
    expect(slots[0]?.x).toBeCloseTo(532);
    expect(slots[1]?.x).toBeCloseTo(908);
    expect(slots[0]?.y).toBeCloseTo(374);
    expect(slots[2]?.y).toBeCloseTo(634);

    const compactSlot = getWorksCaseGridSlot(0, 4, { height: 600, width: 1024 });
    expect(compactSlot.width).toBeLessThan(352);
    expect(compactSlot.y - compactSlot.height / 2).toBeGreaterThanOrEqual(104);
  });

  it("adapts Case columns automatically as more projects are plugged in", () => {
    const viewport = { height: 900, width: 1440 };

    expect(resolveWorksCaseGridLayout(4, viewport)).toMatchObject({ columns: 2, rows: 2 });
    expect(resolveWorksCaseGridLayout(6, viewport)).toMatchObject({ columns: 3, rows: 2 });
    expect(resolveWorksCaseGridLayout(8, viewport)).toMatchObject({ columns: 3, rows: 3 });
    expect(resolveWorksCaseGridLayout(12, viewport)).toMatchObject({ columns: 4, rows: 3 });

    const twelveSlots = Array.from({ length: 12 }, (_value, index) =>
      getWorksCaseGridSlot(index, 12, viewport),
    );
    expect(
      twelveSlots.every(
        (slot) =>
          slot.x - slot.width / 2 >= 23.99 &&
          slot.x + slot.width / 2 <= viewport.width - 23.99 &&
          slot.y - slot.height / 2 >= 103.99 &&
          slot.y + slot.height / 2 <= viewport.height - 31.99,
      ),
    ).toBe(true);
  });

  it("keeps front and back orbit cards inside a compact vertical corridor", () => {
    const radii = getWorksOrbitRadii(1440);
    const frontElapsed = (Math.PI / 2 + Math.PI * 0.12) / 0.24;
    const backElapsed = (Math.PI * 1.5 + Math.PI * 0.12) / 0.24;
    const front = createWorksOrbitCardFrame({
      count: 1,
      elapsed: frontElapsed,
      index: 0,
      radiusX: radii.radiusX,
      radiusY: radii.radiusY,
      radiusZ: radii.radiusZ,
    });
    const back = createWorksOrbitCardFrame({
      count: 1,
      elapsed: backElapsed,
      index: 0,
      radiusX: radii.radiusX,
      radiusY: radii.radiusY,
      radiusZ: radii.radiusZ,
    });

    expect(front.position.y).toBeLessThanOrEqual(2.1);
    expect(back.position.y).toBeGreaterThanOrEqual(-2.8);
  });

  it("keeps the projected orbit inside desktop navigation and viewport safe areas", () => {
    const width = 1920;
    const height = 1080;
    const camera = createCamera();
    camera.aspect = width / height;
    camera.fov = 75;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const cards = createWorksOrbitCards({ theme: "night", works });

    for (const elapsed of [0, 3, 6, 9, 12]) {
      cards.update({
        camera,
        center: new THREE.Vector3(),
        delta: 0.016,
        elapsed,
        layout: "orbit",
        reducedMotion: false,
        viewport: { height, width },
        visible: true,
      });

      for (const cardGroup of cards.group.children as THREE.Group[]) {
        const projected = cardGroup.position.clone().project(camera);
        const viewDepth = Math.abs(
          cardGroup.position.clone().applyMatrix4(camera.matrixWorldInverse).z,
        );
        const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * viewDepth;
        const viewWidth = viewHeight * camera.aspect;
        const rotationZ = cardGroup.rotation.z;
        const rotatedWidth =
          WORKS_ORBIT_CARD_SIZE.width * Math.abs(Math.cos(rotationZ)) +
          WORKS_ORBIT_CARD_SIZE.height * Math.abs(Math.sin(rotationZ));
        const rotatedHeight =
          WORKS_ORBIT_CARD_SIZE.height * Math.abs(Math.cos(rotationZ)) +
          WORKS_ORBIT_CARD_SIZE.width * Math.abs(Math.sin(rotationZ));
        const halfWidthNdc = (rotatedWidth * cardGroup.scale.x) / viewWidth;
        const halfHeightNdc = (rotatedHeight * cardGroup.scale.y) / viewHeight;
        const left = ((projected.x - halfWidthNdc + 1) * width) / 2;
        const right = ((projected.x + halfWidthNdc + 1) * width) / 2;
        const top = ((1 - projected.y - halfHeightNdc) * height) / 2;
        const bottom = ((1 - projected.y + halfHeightNdc) * height) / 2;

        expect(left).toBeGreaterThanOrEqual(23.9);
        expect(right).toBeLessThanOrEqual(width - 23.9);
        expect(top).toBeGreaterThanOrEqual(103.9);
        expect(bottom).toBeLessThanOrEqual(height - 31.9);
      }
    }

    cards.dispose();
  });

  it("recalls Orbit cards into Case slots and sends them back into flight", () => {
    const camera = createCamera();
    const cards = createWorksOrbitCards({ theme: "night", works });
    const viewport = { height: 900, width: 1440 };
    updateOrbitCards(cards, camera, 0, 0.016);

    const orbitPosition = cards.group.children[0]?.position.clone();
    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 0.36,
      elapsed: 0.36,
      layout: "case",
      reducedMotion: false,
      viewport,
      visible: true,
    });

    expect(cards.isLayoutTransitioning()).toBe(true);
    expect(cards.group.children[0]?.position.equals(orbitPosition ?? new THREE.Vector3())).toBe(false);

    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 0.36,
      elapsed: 0.72,
      layout: "case",
      reducedMotion: false,
      viewport,
      visible: true,
    });

    expect(cards.isLayoutTransitioning()).toBe(false);
    const projected = cards.group.children[0]?.position.clone().project(camera);
    const slot = getWorksCaseGridSlot(0, works.length, viewport);
    expect(((projected?.x ?? 0) + 1) * viewport.width * 0.5).toBeCloseTo(slot.x, 2);
    expect((1 - (projected?.y ?? 0)) * viewport.height * 0.5).toBeCloseTo(slot.y, 2);

    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 0.36,
      elapsed: 1.08,
      layout: "orbit",
      reducedMotion: false,
      viewport,
      visible: true,
    });
    expect(cards.isLayoutTransitioning()).toBe(true);

    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 0.36,
      elapsed: 1.44,
      layout: "orbit",
      reducedMotion: false,
      viewport,
      visible: true,
    });
    expect(cards.isLayoutTransitioning()).toBe(false);

    cards.dispose();
  });

  it("keeps the Case Website and Source actions clickable without turning the whole card into a link", () => {
    const camera = createCamera();
    const cards = createWorksOrbitCards({ theme: "night", works });
    const viewport = { height: 900, width: 1440 };
    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 0,
      elapsed: 0,
      layout: "case",
      reducedMotion: true,
      viewport,
      visible: true,
    });

    const slot = getWorksCaseGridSlot(0, works.length, viewport);
    const center = new THREE.Vector2(
      (slot.x / viewport.width) * 2 - 1,
      1 - (slot.y / viewport.height) * 2,
    );
    const halfWidth = slot.width / viewport.width;
    const halfHeight = slot.height / viewport.height;
    const raycaster = new THREE.Raycaster();

    const livePointer = center
      .clone()
      .add(new THREE.Vector2(halfWidth * 0.65, halfHeight * -0.45));
    raycaster.setFromCamera(livePointer, camera);
    const liveHit = cards.pick(raycaster, livePointer);
    expect(liveHit).toEqual(
      expect.objectContaining({ action: "live", url: works[0]?.liveUrl }),
    );

    const githubPointer = center
      .clone()
      .add(new THREE.Vector2(halfWidth * 0.65, halfHeight * -0.68));
    raycaster.setFromCamera(githubPointer, camera);
    expect(cards.pick(raycaster, githubPointer)).toEqual(
      expect.objectContaining({ action: "github", url: works[0]?.githubUrl }),
    );

    raycaster.setFromCamera(center, camera);
    expect(cards.pick(raycaster, center)).toBeNull();
    expect(cards.pickHover(raycaster, center)).toEqual(
      expect.objectContaining({ slug: works[0]?.slug }),
    );
    const screenBounds = cards.getScreenBounds(works[0]!.slug);
    expect(screenBounds).not.toBeNull();
    expect(screenBounds!.halfHeight).toBeGreaterThan(0);
    expect(screenBounds!.halfWidth).toBeCloseTo(halfWidth);
    expect(screenBounds!.x).toBeCloseTo(center.x);
    expect(screenBounds!.y).toBeCloseTo(center.y);
    const liveBounds = cards.getActionScreenBounds(liveHit!);
    expect(liveBounds?.corners).toHaveLength(4);
    expect(liveBounds!.halfWidth).toBeLessThan(screenBounds!.halfWidth / 2);
    expect(liveBounds!.x).toBeGreaterThan(screenBounds!.x);
    expect(cards.getScreenBounds("missing-work")).toBeNull();

    cards.dispose();
  });

  it("tilts the hovered Case card toward the local pointer like a Friend card", () => {
    const camera = createCamera();
    const cards = createWorksOrbitCards({ theme: "night", works });
    const viewport = { height: 900, width: 1440 };
    const cardGroup = cards.group.children[0] as THREE.Group;
    const slot = getWorksCaseGridSlot(0, works.length, viewport);
    const center = new THREE.Vector2(
      (slot.x / viewport.width) * 2 - 1,
      1 - (slot.y / viewport.height) * 2,
    );
    const pointer = center
      .clone()
      .add(
        new THREE.Vector2(
          (slot.width / viewport.width) * 0.72,
          (slot.height / viewport.height) * 0.6,
        ),
      );
    const raycaster = new THREE.Raycaster();

    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 1,
      elapsed: 1,
      layout: "case",
      pointerNdc: center,
      reducedMotion: false,
      viewport,
      visible: true,
    });
    const neutralQuaternion = cardGroup.quaternion.clone();
    const neutralScale = cardGroup.scale.x;

    raycaster.setFromCamera(pointer, camera);
    const hoverHit = cards.pickHover(raycaster, pointer);
    expect(hoverHit).toEqual(expect.objectContaining({ slug: works[0]?.slug }));
    expect(cards.pick(raycaster, pointer)).toBeNull();
    cards.setHovered(hoverHit);

    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 1,
      elapsed: 2,
      layout: "case",
      pointerNdc: pointer,
      reducedMotion: false,
      viewport,
      visible: true,
    });
    expect(cardGroup.quaternion.angleTo(neutralQuaternion)).toBeGreaterThan(0.04);
    expect(cardGroup.scale.x).toBeGreaterThan(neutralScale);
    const tiltedActionBounds = cards.getActionScreenBounds({
      action: "live",
      slug: works[0]!.slug,
      url: works[0]!.liveUrl,
    });
    expect(tiltedActionBounds?.corners).toHaveLength(4);
    expect(
      Math.abs(tiltedActionBounds!.corners![0].y - tiltedActionBounds!.corners![1].y),
    ).toBeGreaterThan(0.0001);

    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 1,
      elapsed: 3,
      layout: "case",
      pointerNdc: pointer,
      reducedMotion: true,
      viewport,
      visible: true,
    });
    expect(cardGroup.quaternion.angleTo(neutralQuaternion)).toBeLessThan(0.0001);

    cards.dispose();
  });

  it("tilts Orbit cards locally while easing hover scale in and out", () => {
    const camera = createCamera();
    const cards = createWorksOrbitCards({ theme: "night", works });
    const viewport = { height: 900, width: 1440 };
    const cardGroup = cards.group.children[0] as THREE.Group;

    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 1,
      elapsed: 1,
      layout: "orbit",
      pointerNdc: new THREE.Vector2(),
      reducedMotion: false,
      viewport,
      visible: true,
    });

    const bounds = cards.getScreenBounds(works[0]!.slug)!;
    const pointer = new THREE.Vector2(
      bounds.x + bounds.halfWidth * 0.68,
      bounds.y + bounds.halfHeight * 0.62,
    );
    const neutralQuaternion = cardGroup.quaternion.clone();
    const neutralScale = cardGroup.scale.x;
    cards.setHovered({ action: "live", slug: works[0]!.slug, url: works[0]!.liveUrl });

    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 0.016,
      elapsed: 1,
      layout: "orbit",
      pointerNdc: pointer,
      reducedMotion: false,
      viewport,
      visible: true,
    });

    expect(cardGroup.quaternion.angleTo(neutralQuaternion)).toBeGreaterThan(0.005);
    expect(cardGroup.scale.x).toBeGreaterThan(neutralScale);
    expect(cardGroup.scale.x).toBeLessThan(neutralScale * 1.08);

    for (let index = 0; index < 60; index += 1) {
      cards.update({
        camera,
        center: new THREE.Vector3(),
        delta: 0.016,
        elapsed: 1,
        layout: "orbit",
        pointerNdc: pointer,
        reducedMotion: false,
        viewport,
        visible: true,
      });
    }
    const expandedScale = cardGroup.scale.x;
    expect(expandedScale / neutralScale).toBeCloseTo(1.08, 2);

    cards.setHovered(null);
    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 0.016,
      elapsed: 1,
      layout: "orbit",
      pointerNdc: pointer,
      reducedMotion: false,
      viewport,
      visible: true,
    });
    expect(cardGroup.scale.x).toBeLessThan(expandedScale);
    expect(cardGroup.scale.x).toBeGreaterThan(neutralScale);

    cards.dispose();
  });

  it("launches the live URL only when a dragged card is released in the center zone", () => {
    const camera = createCamera();
    const cards = createWorksOrbitCards({ theme: "night", works });

    cards.beginDrag(
      { action: "live", slug: "blog", url: works[0].liveUrl },
      new THREE.Vector2(-0.6, 0.15),
    );
    cards.drag(new THREE.Vector2(0.08, -0.04));
    updateOrbitCards(cards, camera, 0.1, 1);

    expect(cards.isInteracting()).toBe(true);

    expect(cards.release(0.2)).toEqual({
      action: "launch",
      url: works[0].liveUrl,
    });
    expect(cards.isInteracting()).toBe(false);

    cards.dispose();
  });

  it("eases a grabbed Orbit card forward without snapping its pose", () => {
    const camera = createCamera();
    const cards = createWorksOrbitCards({ theme: "night", works });
    const cardGroup = cards.group.children[0] as THREE.Group;
    const viewport = { height: 900, width: 1440 };

    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 0.016,
      elapsed: 1,
      layout: "orbit",
      reducedMotion: false,
      viewport,
      visible: true,
    });

    const bounds = cards.getScreenBounds(works[0]!.slug)!;
    const pointer = new THREE.Vector2(
      bounds.x + bounds.halfWidth * 0.62,
      bounds.y + bounds.halfHeight * 0.34,
    );
    const startPosition = cardGroup.position.clone();
    const startScreenPosition = startPosition.clone().project(camera);
    const startScale = cardGroup.scale.x;
    const startRenderOrder = cardGroup.renderOrder;

    cards.beginDrag(
      { action: "live", slug: works[0]!.slug, url: works[0]!.liveUrl },
      pointer,
    );
    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 0.016,
      elapsed: 1.016,
      layout: "orbit",
      pointerNdc: pointer,
      reducedMotion: false,
      viewport,
      visible: true,
    });

    const firstFramePosition = cardGroup.position.clone();
    const firstFrameScreenPosition = firstFramePosition.clone().project(camera);
    const firstFrameScale = cardGroup.scale.x;
    expect(firstFramePosition.distanceTo(startPosition)).toBeLessThan(0.12);
    expect(firstFrameScreenPosition.distanceTo(startScreenPosition)).toBeLessThan(0.002);
    expect(firstFrameScale).toBeGreaterThan(startScale);
    expect(firstFrameScale).toBeLessThan(startScale * 1.02);
    expect(cardGroup.renderOrder).toBeGreaterThan(startRenderOrder);
    expect(cardGroup.renderOrder).toBeLessThan(300);

    for (let index = 0; index < 24; index += 1) {
      cards.update({
        camera,
        center: new THREE.Vector3(),
        delta: 0.016,
        elapsed: 1.032 + index * 0.016,
        layout: "orbit",
        pointerNdc: pointer,
        reducedMotion: false,
        viewport,
        visible: true,
      });
    }

    expect(cardGroup.position.distanceTo(startPosition)).toBeGreaterThan(1);
    expect(cardGroup.scale.x).toBeGreaterThan(firstFrameScale);
    expect(cardGroup.renderOrder).toBe(1_000);

    cards.dispose();
  });

  it("resumes immediately from a non-center release without a hold delay", () => {
    const camera = createCamera();
    const cards = createWorksOrbitCards({ theme: "night", works });
    const cardGroup = cards.group.children[0] as THREE.Group;

    cards.beginDrag(
      { action: "live", slug: "blog", url: works[0].liveUrl },
      new THREE.Vector2(-0.6, 0.15),
    );
    cards.drag(new THREE.Vector2(0.84, 0.42));
    updateOrbitCards(cards, camera, 0.1, 1);
    const releasePosition = cardGroup.position.clone();

    expect(cards.release(0.1)).toEqual({ action: "resume" });
    expect(cards.isInteracting()).toBe(false);

    updateOrbitCards(cards, camera, 0.12, 0.016);

    expect(cardGroup.position.distanceTo(releasePosition)).toBeGreaterThan(0.1);
    expect(cardGroup.renderOrder).toBeLessThan(900);
    expect(cards.isInteracting()).toBe(false);

    cards.dispose();
  });

  it("keeps the release pose on the first resume frame, then animates back to orbit", () => {
    const camera = createCamera();
    const cards = createWorksOrbitCards({ theme: "night", works });
    const cardGroup = cards.group.children[0] as THREE.Group;

    cards.beginDrag(
      { action: "live", slug: "blog", url: works[0].liveUrl },
      new THREE.Vector2(-0.6, 0.15),
    );
    cards.drag(new THREE.Vector2(0.7, 0.34));
    updateOrbitCards(cards, camera, 0.1, 1);
    const releasePosition = cardGroup.position.clone();

    expect(cards.release(0.1)).toEqual({ action: "resume" });

    updateOrbitCards(cards, camera, 0.1, 0.016);
    expect(cardGroup.position.distanceTo(releasePosition)).toBeLessThan(0.001);

    updateOrbitCards(cards, camera, 0.14, 0.016);
    expect(cardGroup.position.distanceTo(releasePosition)).toBeGreaterThan(0.05);

    cards.dispose();
  });

  it("does not launch when release is called without a drag", () => {
    const cards = createWorksOrbitCards({ theme: "night", works });

    expect(cards.release(0)).toBeNull();

    cards.dispose();
  });

  it("renders a refractive glass layer behind sharp card content", () => {
    const cards = createWorksOrbitCards({ theme: "night", works });
    const cardGroup = cards.group.children[0] as THREE.Group;
    const cardMesh = cardGroup.children.find((child) => child.name.startsWith("work-card-content-")) as
      | THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
      | undefined;
    const glassMesh = cardGroup.children.find((child) => child.name.startsWith("work-card-glass-")) as
      | THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
      | undefined;

    expect(cardMesh).toBeDefined();
    expect(glassMesh).toBeDefined();
    expect(cardMesh?.layers.mask).toBe(1 << WORKS_ORBIT_CARD_RENDER_LAYER);
    expect(glassMesh?.layers.mask).toBe(1 << WORKS_ORBIT_CARD_RENDER_LAYER);
    expect(cardMesh?.material.depthTest).toBe(true);
    expect(cardMesh?.material.depthWrite).toBe(false);
    expect(cardMesh?.material.alphaTest).toBeGreaterThan(0);
    expect(cardMesh?.material.transparent).toBe(true);
    expect(cardMesh?.material.opacity).toBe(1);
    expect((cardMesh?.material.map as THREE.CanvasTexture).premultiplyAlpha).toBe(false);
    expect(
      ((cardMesh?.material.map as THREE.CanvasTexture).image as HTMLCanvasElement).width /
        ((cardMesh?.material.map as THREE.CanvasTexture).image as HTMLCanvasElement).height,
    ).toBeCloseTo(352 / 236);
    expect(glassMesh?.material.depthTest).toBe(true);
    expect(glassMesh?.material.depthWrite).toBe(false);
    expect(glassMesh?.material.fragmentShader).toContain("roundedBoxSdf");
    expect(glassMesh?.material.fragmentShader).toContain("uBackdrop");
    expect(glassMesh?.material.fragmentShader).toContain("readFrostedBackdrop");
    expect(glassMesh?.material.fragmentShader).toContain("screenBlend");
    expect(glassMesh?.material.fragmentShader).toContain("overlayBlend");
    expect(glassMesh?.material.uniforms.uRefraction.value).toBe(
      WORKS_WEBGL_GLASS_PROFILE.refraction,
    );
    expect(glassMesh?.material.uniforms.uAberration.value).toBe(0);
    expect(glassMesh?.material.uniforms.uBevelDepth.value).toBe(
      WORKS_WEBGL_GLASS_PROFILE.bevelDepth,
    );
    expect(glassMesh?.material.uniforms.uBevelWidth.value).toBe(
      WORKS_WEBGL_GLASS_PROFILE.bevelWidth,
    );
    expect(glassMesh?.material.uniforms.uFrost.value).toBe(WORKS_WEBGL_GLASS_PROFILE.frost);
    expect(glassMesh?.material.uniforms.uSaturation.value).toBe(1.4);
    expect(glassMesh?.material.uniforms.uRimWidthPx.value).toBe(1.5);
    expect(glassMesh?.material.uniforms.uDayBorderWidthPx.value).toBe(1);
    expect(glassMesh?.material.uniforms.uDayMode.value).toBe(0);
    expect(glassMesh?.material.uniforms.uGlassOpacity.value).toBe(0.64);
    expect(glassMesh?.material.uniforms.uTintStrength.value).toBe(0.075);

    cards.dispose();
  });

  it("enables the one-pixel dark edge only for day cards", () => {
    const cards = createWorksOrbitCards({ theme: "night", works });
    const cardGroup = cards.group.children[0] as THREE.Group;
    const glassMesh = cardGroup.children.find((child) => child.name.startsWith("work-card-glass-")) as
      | THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
      | undefined;

    expect(glassMesh?.material.uniforms.uDayMode.value).toBe(0);
    cards.setTheme("day");
    expect(glassMesh?.material.uniforms.uDayMode.value).toBe(1);
    expect(glassMesh?.material.uniforms.uAberration.value).toBe(0.01);
    expect(glassMesh?.material.uniforms.uGlassOpacity.value).toBe(0.58);
    expect(glassMesh?.material.uniforms.uTintStrength.value).toBe(0.18);
    cards.setTheme("night");
    expect(glassMesh?.material.uniforms.uDayMode.value).toBe(0);
    expect(glassMesh?.material.uniforms.uAberration.value).toBe(0);
    expect(glassMesh?.material.uniforms.uGlassOpacity.value).toBe(0.64);
    expect(glassMesh?.material.uniforms.uTintStrength.value).toBe(0.075);

    cards.dispose();
  });

  it("draws the same content hierarchy as the Case cards", () => {
    const context = mockCanvasContext();
    const cards = createWorksOrbitCards({ theme: "night", works });
    const labels = context.fillText.mock.calls.map(([label]) => label);

    expect(labels).toEqual(
      expect.arrayContaining([
        "WoodFishNest",
        "01",
        "BLOG",
        "Website:",
        "进入项目",
        "Source:",
        "GitHub",
      ]),
    );
    expect(labels).not.toContain("DRAG TO OPEN");
    expect(labels).not.toContain("woodfish.site");

    cards.dispose();
  });

  it("captures the base framebuffer at the active drawing-buffer resolution", () => {
    const cards = createWorksOrbitCards({ theme: "night", works });
    const glassMeshes = (cards.group.children as THREE.Group[]).map(
      (cardGroup) =>
        cardGroup.children.find((child) => child.name.startsWith("work-card-glass-")) as THREE.Mesh<
          THREE.PlaneGeometry,
          THREE.ShaderMaterial
        >,
    );
    const glassMesh = glassMeshes[0];
    const copyFramebufferToTexture = vi.fn();
    const initialBackdrop = glassMesh?.material.uniforms.uBackdrop.value as THREE.FramebufferTexture;
    const disposeInitialBackdrop = vi.spyOn(initialBackdrop, "dispose");
    const drawingBufferSize = new THREE.Vector2(2880, 1800);
    const renderer = {
      copyFramebufferToTexture,
      getDrawingBufferSize: (target: THREE.Vector2) => target.copy(drawingBufferSize),
    } as unknown as THREE.WebGLRenderer;

    cards.captureBackdrop(renderer);

    expect(copyFramebufferToTexture).toHaveBeenCalledTimes(1);
    expect(disposeInitialBackdrop).toHaveBeenCalledTimes(1);
    const fullSizeBackdrop = glassMesh?.material.uniforms.uBackdrop.value as THREE.FramebufferTexture;
    expect(fullSizeBackdrop).not.toBe(initialBackdrop);
    expect(
      glassMeshes.every((mesh) => mesh.material.uniforms.uBackdrop.value === fullSizeBackdrop),
    ).toBe(true);
    expect(fullSizeBackdrop).toEqual(
      expect.objectContaining({
        image: expect.objectContaining({ height: 1800, width: 2880 }),
      }),
    );
    expect(glassMesh?.material.uniforms.uResolution.value).toEqual(
      expect.objectContaining({ x: 2880, y: 1800 }),
    );

    cards.captureBackdrop(renderer);
    expect(glassMesh?.material.uniforms.uBackdrop.value).toBe(fullSizeBackdrop);

    const disposeFullSizeBackdrop = vi.spyOn(fullSizeBackdrop, "dispose");
    drawingBufferSize.set(1920, 1080);
    cards.captureBackdrop(renderer);

    expect(disposeFullSizeBackdrop).toHaveBeenCalledTimes(1);
    const resizedBackdrop = glassMesh?.material.uniforms.uBackdrop.value as THREE.FramebufferTexture;
    expect(resizedBackdrop).toEqual(
      expect.objectContaining({
        image: expect.objectContaining({ height: 1080, width: 1920 }),
      }),
    );
    expect(glassMeshes.every((mesh) => mesh.material.uniforms.uBackdrop.value === resizedBackdrop)).toBe(
      true,
    );
    expect(copyFramebufferToTexture).toHaveBeenCalledTimes(3);

    const disposeResizedBackdrop = vi.spyOn(resizedBackdrop, "dispose");
    cards.dispose();
    expect(disposeResizedBackdrop).toHaveBeenCalledTimes(1);
  });

  it("keeps card material opacity at full strength during orbit updates", () => {
    const camera = createCamera();
    const cards = createWorksOrbitCards({ theme: "night", works });
    const cardGroup = cards.group.children[0] as THREE.Group;
    const cardMesh = cardGroup.children.find((child) => child.name.startsWith("work-card-content-")) as
      | THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
      | undefined;
    const glassMesh = cardGroup.children.find((child) => child.name.startsWith("work-card-glass-")) as
      | THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
      | undefined;

    updateOrbitCards(cards, camera, 0.2, 0.016);

    expect(cardMesh?.material.opacity).toBe(1);
    expect(glassMesh?.material.uniforms.uPointer.value).toEqual(
      expect.objectContaining({ x: 0.5, y: 0.5 }),
    );

    cards.dispose();
  });

  it("hides Works cards immediately when the active route leaves Works", () => {
    const camera = createCamera();
    const cards = createWorksOrbitCards({ theme: "night", works });
    const cardGroup = cards.group.children[0] as THREE.Group;
    const cardMesh = cardGroup.children.find((child) => child.name.startsWith("work-card-content-")) as
      | THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
      | undefined;
    const glassMesh = cardGroup.children.find((child) => child.name.startsWith("work-card-glass-")) as
      | THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
      | undefined;

    updateOrbitCards(cards, camera, 0.2, 0.016);
    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 0.016,
      elapsed: 0.216,
      layout: "orbit",
      pointerNdc: new THREE.Vector2(),
      reducedMotion: false,
      viewport: { height: 900, width: 1440 },
      visible: false,
    });

    expect(cards.group.visible).toBe(false);
    expect(cardMesh?.material.opacity).toBe(0);
    expect(glassMesh?.material.uniforms.uViewAlpha.value).toBe(0);
    expect(cards.pick(new THREE.Raycaster(), new THREE.Vector2())).toBeNull();

    cards.dispose();
  });

  it("identifies the center launch zone and caps ritual intensity for reduced motion", () => {
    expect(isWorksLaunchZone(new THREE.Vector2(0.1, -0.1))).toBe(true);
    expect(isWorksLaunchZone(new THREE.Vector2(0.4, 0))).toBe(false);

    expect(getWorksCenterMagnetStrength(new THREE.Vector2(0, 0), false)).toBe(1);
    expect(getWorksCenterMagnetStrength(new THREE.Vector2(0, 0), true)).toBeLessThanOrEqual(0.25);
    expect(getWorksCenterMagnetStrength(new THREE.Vector2(0.8, 0.8), false)).toBe(0);
  });
});
