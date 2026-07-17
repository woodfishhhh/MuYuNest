import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createWorksOrbitCardFrame,
  createWorksOrbitCards,
  getWorksCenterMagnetStrength,
  getWorksOrbitRadii,
  isWorksLaunchZone,
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
    liveUrl: "http://36.151.148.198/newBlog/",
    githubUrl: "https://github.com/woodfishhhh/VueThreeBlog",
  },
  {
    slug: "weather",
    name: "WeatherDemo",
    description: "Monochrome weather workspace and forecast explorer.",
    kind: "App",
    liveUrl: "https://woodfish.site/weather/",
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
    expect(glassMesh?.material.depthWrite).toBe(true);
    expect(glassMesh?.material.fragmentShader).toContain("roundedBoxSdf");
    expect(glassMesh?.material.fragmentShader).toContain("uBackdrop");
    expect(glassMesh?.material.fragmentShader).toContain("screenBlend");
    expect(glassMesh?.material.fragmentShader).toContain("overlayBlend");
    expect(glassMesh?.material.uniforms.uBlurPx.value).toBe(20);
    expect(glassMesh?.material.uniforms.uSaturation.value).toBe(1.4);
    expect(glassMesh?.material.uniforms.uDisplacementScale.value).toBe(100);
    expect(glassMesh?.material.uniforms.uAberrationIntensity.value).toBe(2);
    expect(glassMesh?.material.uniforms.uAberrationBlur.value).toBe(0.3);
    expect(glassMesh?.material.uniforms.uRimWidthPx.value).toBe(1.5);
    expect(glassMesh?.material.uniforms.uDayBorderWidthPx.value).toBe(1);
    expect(glassMesh?.material.uniforms.uDayMode.value).toBe(0);

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
    cards.setTheme("night");
    expect(glassMesh?.material.uniforms.uDayMode.value).toBe(0);

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

  it("crossfades Orbit cards while disabling interaction as soon as Case is selected", () => {
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
      pointerNdc: new THREE.Vector2(),
      reducedMotion: false,
      viewport: { height: 900, width: 1440 },
      visible: false,
    });

    expect(cards.group.visible).toBe(true);
    expect(cardMesh?.material.opacity).toBeGreaterThan(0);
    expect(cardMesh?.material.opacity).toBeLessThan(1);
    expect(glassMesh?.material.uniforms.uViewAlpha.value).toBe(cardMesh?.material.opacity);
    expect(cards.pick(new THREE.Raycaster(), new THREE.Vector2())).toBeNull();

    cards.update({
      camera,
      center: new THREE.Vector3(),
      delta: 1,
      elapsed: 1.216,
      reducedMotion: false,
      viewport: { height: 900, width: 1440 },
      visible: false,
    });

    expect(cards.group.visible).toBe(false);
    expect(cardMesh?.material.opacity).toBe(0);
    expect(glassMesh?.material.uniforms.uViewAlpha.value).toBe(0);

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
