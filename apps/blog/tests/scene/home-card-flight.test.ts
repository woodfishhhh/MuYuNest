import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Flight, layoutFor, seededRandom } from "@/components/scene/home-card-flight/motion";
import { Flight as ApprovedFlight } from "./fixtures/approved-home-flight";
import { getHomeGeometryAnchor, blendDockAnchors } from "@/components/scene/home-card-flight/layout";
import { getBlogDockTransform } from "@/components/scene/blog-dock";
import { createHomeCardFlight } from "@/components/scene/home-card-flight";

describe("home flight integration", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("preserves the approved demo's flight, pickup, reversal and release exactly", () => {
    const actual = new Flight(2);
    const approved = new ApprovedFlight(2);
    actual.reset(layoutFor(1651, 871), seededRandom(42));
    approved.reset(layoutFor(1651, 871), seededRandom(42));
    for (let i = 0; i < 100; i++) { actual.tick(undefined, 2.5); approved.tick(undefined, 2.5); }
    expect({ ...actual }).toEqual({ ...approved });
    actual.state = approved.state = "dragging";
    for (const target of [{ x: 500, y: -300 }, { x: -650, y: 300 }]) {
      for (let i = 0; i < 120; i++) {
        actual.tick(target, 2.5); approved.tick(target, 2.5);
        expect({ ...actual }).toEqual({ ...approved });
      }
    }
    actual.state = approved.state = "vanishing";
    for (let i = 0; i < 61; i++) { actual.tick(); approved.tick(); }
    expect({ ...actual }).toEqual({ ...approved });
  });

  it.each([[1651, 871], [390, 844]])("aligns either geometry with the card emission origin at %i x %i", (width, height) => {
    const viewport = { left: 20, top: 15, width, height };
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0.4, 0.2, 12); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    for (const diameter of [6, 10]) {
      const target = getBlogDockTransform(camera, viewport, getHomeGeometryAnchor(viewport), diameter);
      const projected = target.position.clone().project(camera);
      expect((projected.x + 1) * width / 2).toBeCloseTo(width / 2);
      expect((1 - projected.y) * height / 2).toBeCloseTo(height * 0.512);
    }
  });

  it("keeps the pre-existing Blog dock intact and blends the Home transition", () => {
    const home = getHomeGeometryAnchor({ left: 0, top: 0, width: 1440, height: 900 });
    const blog = { left: 180, top: 24, width: 50, height: 28 };
    expect(blendDockAnchors(home, blog, 1, 0)).toEqual(home);
    expect(blendDockAnchors(home, blog, 0, 1)).toEqual(blog);
    expect(blendDockAnchors(home, blog, 0.5, 0.5).left).toBeCloseTo((home.left + blog.left) / 2);
  });

  function mockAssets(decode = (_src: string) => Promise.resolve()) {
    const requests: string[] = [];
    vi.stubGlobal("Image", class {
      src = ""; naturalWidth = 32; naturalHeight = 32;
      decode() { requests.push(this.src); return decode(this.src); }
    });
    vi.stubGlobal("FontFace", class { load() { return Promise.resolve(this); } });
    const fonts = { add: vi.fn(), delete: vi.fn() };
    const previous = Object.getOwnPropertyDescriptor(document, "fonts");
    Object.defineProperty(document, "fonts", { configurable: true, value: fonts });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      strokeRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), save: vi.fn(), rect: vi.fn(), clip: vi.fn(), restore: vi.fn(),
      scale: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), fillText: vi.fn(), putImageData: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 7 }),
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
    } as unknown as CanvasRenderingContext2D);
    return { fonts, requests, restore: () => {
      if (previous) Object.defineProperty(document, "fonts", previous);
      else Reflect.deleteProperty(document, "fonts");
    } };
  }

  function mockRenderer() {
    return { capabilities: { getMaxAnisotropy: () => 4 }, autoClear: true,
      clearDepth: vi.fn(), render: vi.fn(), dispose: vi.fn() };
  }

  it("pauses outside Home, preserves renderer state and disposes only owned resources", async () => {
    const assets = mockAssets();
    const renderer = mockRenderer();
    const onReady = vi.fn();
    const textureDispose = vi.spyOn(THREE.Texture.prototype, "dispose");
    const cards = createHomeCardFlight({ renderer: renderer as unknown as THREE.WebGLRenderer,
      width: 1651, height: 871, theme: "day", onReady });
    try {
      await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      cards.update(0.1, true, false); cards.render();
      expect(renderer.render).toHaveBeenCalledOnce();
      expect(renderer.autoClear).toBe(true);
      const scene = renderer.render.mock.calls[0][0] as THREE.Scene;
      expect(scene.children.length).toBeGreaterThanOrEqual(2);
      expect(scene.children.filter(child => child.visible)).toHaveLength(2);
      const visibleCard = scene.children.find(child => child.visible && child.userData.cardId) as THREE.Mesh;
      const front = (visibleCard.material as THREE.MeshBasicMaterial[])[4];
      const oldTexture = front.map!;
      const position = visibleCard.position.clone();
      cards.setTheme("night");
      expect(front.map).not.toBe(oldTexture);
      expect(visibleCard.position).toEqual(position);
      expect(textureDispose.mock.instances).toContain(oldTexture);
      const darkTexture = front.map;
      cards.setTheme("night");
      expect(front.map).toBe(darkTexture);
      for (let i = 0; i < 300; i++) {
        cards.update(0.1, true, false);
        expect(scene.children.filter(child => child.visible).length).toBeLessThanOrEqual(2);
      }
      const before = scene.children.map(child => child.position.clone());
      cards.update(10, false, false); cards.render();
      expect(renderer.render).toHaveBeenCalledOnce();
      expect(cards.pick(new THREE.Vector2())).toBeUndefined();
      expect(scene.children.map(child => child.position)).toEqual(before);
      cards.resize(390, 844); cards.setTheme("night");
      cards.dispose(); cards.dispose();
      expect(scene.children).toHaveLength(0);
      expect(textureDispose).toHaveBeenCalled();
      expect(renderer.dispose).not.toHaveBeenCalled();
    } finally { cards.dispose(); assets.restore(); }
  });

  it("loops each full list without random repeats, alternates content and inserts sparse 3D stars", async () => {
    const assets = mockAssets();
    const { parseCardConfig } = await import("@/components/scene/home-card-flight/card-config");
    const definitions = parseCardConfig({ version: 1, cards: [
      ...Array.from({ length: 4 }, (_, i) => ({ id: `text-${i}`, type: "text", text: "一首小诗。" })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `photo-${i}`, type: "image", src: `https://example.com/photo-${i}.webp`, description: `我的镜头下${i + 1}` })),
    ] }).cards;
    const renderer = mockRenderer(); const onReady = vi.fn();
    const drops: string[] = [];
    const textIds: string[] = []; const imageIds: string[] = [];
    const cards = createHomeCardFlight({ renderer: renderer as unknown as THREE.WebGLRenderer,
      width: 1651, height: 871, theme: "day", cards: definitions, onReady, onDrop: drop => {
        drops.push(drop.kind);
        if (drop.kind === "text") textIds.push(drop.id!);
        if (drop.kind === "image") imageIds.push(drop.id!);
      } });
    try {
      await vi.waitFor(() => expect(drops).toHaveLength(2));
      expect(drops).toEqual(["text", "image"]);
      expect(assets.requests.filter(url => url.startsWith("https://example.com/photo-"))).toHaveLength(1);
      cards.update(0, true, false); cards.render();
      const scene = renderer.render.mock.calls[0][0] as THREE.Scene;
      for (let i = 0; i < 700; i++) {
        cards.update(0.1, true, false);
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        expect(scene.children.filter(child => child.visible).length).toBeLessThanOrEqual(2);
        expect(scene.children.filter(child => child.userData.kind === "image").length).toBeLessThanOrEqual(2);
      }
      const content = drops.filter(kind => kind !== "star");
      expect(content.length).toBeGreaterThan(20);
      content.forEach((kind, i) => expect(kind).toBe(i % 2 ? "image" : "text"));
      expect(textIds.length).toBeGreaterThan(8);
      expect(imageIds.length).toBeGreaterThan(6);
      textIds.forEach((id, i) => expect(id).toBe(`text-${i % 4}`));
      imageIds.forEach((id, i) => expect(id).toBe(`photo-${i % 6}`));
      let gap = 0; let stars = 0;
      for (const kind of drops) {
        if (kind === "star") { expect(gap).toBeGreaterThanOrEqual(3); expect(gap).toBeLessThanOrEqual(6); gap = 0; stars++; }
        else gap++;
      }
      expect(stars).toBeGreaterThan(2);
      const star = scene.children.find(child => child.userData.kind === "star") as THREE.Mesh;
      expect(star.geometry.type).toBe("ExtrudeGeometry");
    } finally { cards.dispose(); assets.restore(); }
  });

  it.each(["inactive", "disposed"])("discards a pending photo when the scene becomes %s", async state => {
    let resolve!: () => void;
    const pending = new Promise<void>(done => { resolve = done; });
    let photoLoads = 0;
    const assets = mockAssets(src => src.startsWith("https://example.com/") && ++photoLoads > 1 ? pending : Promise.resolve());
    const { parseCardConfig } = await import("@/components/scene/home-card-flight/card-config");
    const fixture = parseCardConfig({ version: 1, cards: [
      { id: "poem", type: "text", text: "一首小诗。" },
      { id: "photo", type: "image", src: "https://example.com/photo.webp" },
    ] }).cards;
    const renderer = mockRenderer(); const onDrop = vi.fn();
    const cards = createHomeCardFlight({ renderer: renderer as unknown as THREE.WebGLRenderer,
      width: 1440, height: 900, theme: "night", cards: fixture, onDrop });
    try {
      await vi.waitFor(() => expect(onDrop).toHaveBeenCalledTimes(2));
      cards.update(0, true, false); cards.render();
      const scene = renderer.render.mock.calls[0][0] as THREE.Scene;
      for (let i = 0; i < 150 && photoLoads < 2; i++) {
        cards.update(0.1, true, false);
        await Promise.resolve();
      }
      expect(photoLoads).toBe(2);
      if (state === "disposed") cards.dispose(); else cards.update(0, false, false);
      const emitted = onDrop.mock.calls.length;
      resolve(); await pending; await Promise.resolve(); await Promise.resolve();
      expect(onDrop).toHaveBeenCalledTimes(emitted);
      expect(scene.children.filter(child => child.userData.kind === "image")).toHaveLength(0);
    } finally { cards.dispose(); assets.restore(); }
  });

  it("keeps poems ready when a photo fails, and tolerates an empty collection", async () => {
    const assets = mockAssets();
    const { parseCardConfig } = await import("@/components/scene/home-card-flight/card-config");
    const fixture = parseCardConfig({ version: 1, cards: [
      { id: "poem", type: "text", text: ["一首小诗。"] },
      { id: "photo", type: "image", src: "local:missing.jpg" },
    ] }).cards;
    try {
      for (const definitions of [fixture, []]) {
        const renderer = mockRenderer();
        const onReady = vi.fn(); const onError = vi.fn();
        const cards = createHomeCardFlight({ renderer: renderer as unknown as THREE.WebGLRenderer,
          width: 390, height: 844, theme: "day", cards: definitions, onReady, onError });
        try {
          await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());
          cards.update(0, true, true); cards.render();
          const scene = renderer.render.mock.calls[0][0] as THREE.Scene;
          expect(scene.children.filter(child => child.visible)).toHaveLength(definitions.length ? 1 : 0);
          expect(onError).toHaveBeenCalledTimes(definitions.length ? 1 : 0);
        } finally { cards.dispose(); }
      }
    } finally { assets.restore(); }
  });

  it("does not create GPU resources when unmounted while images are loading", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>(done => { resolve = done; });
    const assets = mockAssets(() => pending);
    const onReady = vi.fn();
    const cards = createHomeCardFlight({ renderer: mockRenderer() as unknown as THREE.WebGLRenderer,
      width: 390, height: 844, theme: "night", onReady });
    try {
      cards.dispose(); resolve();
      await pending; await Promise.resolve(); await Promise.resolve();
      expect(onReady).not.toHaveBeenCalled();
      expect(assets.fonts.add).not.toHaveBeenCalled();
    } finally { assets.restore(); }
  });
});
