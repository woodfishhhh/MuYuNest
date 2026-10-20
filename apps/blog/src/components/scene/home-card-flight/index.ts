import * as THREE from "three";
import { catalog, catalogIssues, resolveImageSource } from "./catalog";
import { createDropSchedule, type DropKind } from "./drop-schedule";
import { createFallingStar } from "./falling-star";
import type { ContentCard } from "./card-config";
import { loadCardImage, renderTextCard, renderImageCard, renderCardReverse, type CardSurface } from "./card-surface";
import { Flight, layoutFor, STEP, PERSPECTIVE, MAX_ACTIVE } from "./motion";
import maskUrl from "../../../assets/home-flight/sprite-vanish.png?url";

export interface HomeCardFlightOptions {
  renderer: THREE.WebGLRenderer;
  width: number;
  height: number;
  theme: "day" | "night";
  cards?: ContentCard[];
  onReady?: () => void;
  onDrop?: (drop: { kind: DropKind; id?: string }) => void;
  onError?: (error: unknown) => void;
}

type Entry = {
  flight: Flight;
  surface: CardSurface;
  mesh: THREE.Mesh;
  width: number;
  height: number;
  materials: THREE.Material[];
  front: THREE.MeshBasicMaterial;
  mask: THREE.Texture;
  liveTexture?: THREE.CanvasTexture;
  wasThrown: boolean;
  zoom: number;
  targetZoom: number;
  disposeImage?: () => void;
  vanish: {
    enabled: { value: number };
    shift: { value: number };
    size: { value: THREE.Vector2 };
    paper: { value: THREE.Color };
  };
};

export function createHomeCardFlight(options: HomeCardFlightOptions) {
  const renderer = options.renderer;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 30000);
  camera.position.z = PERSPECTIVE;
  const raycaster = new THREE.Raycaster();
  const definitions = options.cards ?? catalog;
  let layout = layoutFor(options.width, options.height);
  const random = Math.random;
  const flightSpeed = 2.5;
  let theme = options.theme;
  let disposed = false;
  let ready = false;
  let active = false;
  let accumulator = 0;
  let simTime = 0;
  let nextThrow = 2 / flightSpeed;
  let dragged: Entry | undefined;
  const pointer = { x: layout.smileX, y: layout.smileY };
  const entries: Entry[] = [];
  const schedule = createDropSchedule(random);
  const images = definitions.filter(card => card.type === "image");
  const failedImages = new Set<string>();
  let maskBase: THREE.Texture | undefined;
  let pendingDrop = false;
  let nextEntryIndex = 0;
  let nextTextIndex = 0;
  let nextImageIndex = 0;
  const star = createFallingStar(definitions.length + 1);
  scene.add(star.mesh);
  const reverse = new THREE.CanvasTexture(renderCardReverse(theme));
  reverse.colorSpace = THREE.SRGBColorSpace;
  const backMaterial = new THREE.MeshBasicMaterial({ map: reverse });
  const sideMaterial = new THREE.MeshBasicMaterial({ color: theme === "night" ? "#242830" : "#c8c0b2" });
  const hiddenMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  blank.colorSpace = THREE.SRGBColorSpace;
  blank.needsUpdate = true;
  const resources: { dispose(): void }[] = [reverse, blank, backMaterial, sideMaterial, hiddenMaterial, star];

  function makeMask(image: HTMLImageElement) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = pixels.data[i + 3];
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  }

  function addFrame(surface: CardSurface, maskBase: THREE.Texture) {
    const index = nextEntryIndex++;
    const width = layout.cardWidth * (surface.card.type === "image" ? 0.5 : 1);
    const height = width * surface.height / surface.width;
    const depth = surface.card.type === "image" ? 8 : 16;
    // Clones share the mask image/GPU source; only their UV offsets differ.
    const mask = maskBase.clone();
    const front = new THREE.MeshBasicMaterial({ map: blank, alphaMap: mask, alphaTest: 0.5 });
    const vanish = { enabled: { value: 0 }, shift: { value: 0 },
      size: { value: new THREE.Vector2(width, height) }, paper: { value: new THREE.Color(theme === "day" ? "#fafaf7" : "#050510") } };
    // Original release effect: the photograph erodes first, exposing a paper grid;
    // the same 30-frame mask erodes the grid 105 ms later.
    front.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { uVanish: vanish.enabled, uMaskShift: vanish.shift,
        uCardSize: vanish.size, uPaper: vanish.paper });
      shader.fragmentShader = 'uniform float uVanish; uniform float uMaskShift; uniform vec2 uCardSize; uniform vec3 uPaper;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', `
        #ifdef USE_ALPHAMAP
          float innerMask = texture2D(alphaMap, vAlphaMapUv).g;
          if (uVanish > 0.5) {
            float outerMask = texture2D(alphaMap, vAlphaMapUv + vec2(uMaskShift, 0.0)).g;
            vec2 pixels = (vMapUv - 0.5) * uCardSize;
            vec2 gridUv = mod(pixels + 13.0, 26.0);
            float grid = max(1.0 - step(1.0, gridUv.x), 1.0 - step(1.0, gridUv.y));
            vec3 gridColor = mix(uPaper, vec3(0.008023, 0.0, 0.0), grid);
            diffuseColor.rgb = mix(gridColor, diffuseColor.rgb, innerMask);
            diffuseColor.a *= outerMask;
          } else { diffuseColor.a *= innerMask; }
        #endif
      `);
    };
    const materials = [sideMaterial, sideMaterial, sideMaterial, sideMaterial, front, backMaterial];
    const geometry = new THREE.BoxGeometry(width, height, depth).translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.visible = false;
    mesh.userData.cardId = surface.card.id;
    mesh.userData.kind = surface.card.type;
    mesh.userData.page = surface.page;
    scene.add(mesh);
    const entry: Entry = { flight: new Flight(index), surface, mesh, width, height, materials, front, mask, vanish, wasThrown: false, zoom: 1, targetZoom: 1 };
    entries.push(entry);
    resources.push(mask, front, geometry);
    return entry;
  }

  function releaseTexture(entry: Entry) {
    if (!entry.liveTexture) return;
    entry.liveTexture.dispose();
    const index = resources.indexOf(entry.liveTexture);
    if (index >= 0) resources.splice(index, 1);
    entry.liveTexture = undefined;
    entry.front.map = blank;
  }

  function syncEntry(entry: Entry) {
    const { flight: f, mesh } = entry;
    mesh.visible = f.state !== "waiting";
    if (!mesh.visible) { releaseTexture(entry); return; }
    // Rasterize only the two active pages, instead of allocating the entire poetry collection on the GPU.
    if (!entry.liveTexture) {
      const texture = new THREE.CanvasTexture(entry.surface.render(theme));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      entry.liveTexture = texture; entry.front.map = texture; resources.push(texture);
    }
    mesh.position.set(f.x, layout.perspectiveY - layout.originY - f.y, f.z);
    mesh.rotation.set(-f.rx * Math.PI / 180, f.ry * Math.PI / 180, -f.rz * Math.PI / 180, "XYZ");
    mesh.scale.setScalar(f.s * entry.zoom);
    const frame = f.state === "vanishing" ? Math.min(29, Math.floor(f.vanishAge / 0.75 * 29)) : 0;
    entry.mask.offset.x = frame / 30;
    entry.vanish.enabled.value = f.state === "vanishing" ? 1 : 0;
    const outerFrame = Math.min(29, Math.floor(Math.max(0, f.vanishAge - 0.105) / 0.75 * 29));
    entry.vanish.shift.value = (outerFrame - frame) / 30;
    mesh.material = f.state === "dragging" || f.state === "vanishing"
      ? [hiddenMaterial, hiddenMaterial, hiddenMaterial, hiddenMaterial, entry.front, hiddenMaterial]
      : entry.materials;
  }

  function forgetResource(resource: { dispose(): void }) {
    resource.dispose();
    const index = resources.indexOf(resource);
    if (index >= 0) resources.splice(index, 1);
  }

  function syncEntries() {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.surface.card.type === "image" && entry.wasThrown && entry.flight.state === "waiting") {
        // Drop the decoded image and its closure as soon as it leaves the scene.
        releaseTexture(entry); entry.disposeImage?.();
        forgetResource(entry.mesh.geometry); forgetResource(entry.front); forgetResource(entry.mask);
        scene.remove(entry.mesh); entries.splice(i, 1);
      } else syncEntry(entry);
    }
    star.sync(layout);
  }

  function activeCount() {
    return entries.filter(entry => entry.flight.state !== "waiting").length + Number(star.flight.state !== "waiting");
  }

  async function throwOne(warm = false) {
    if (disposed || !maskBase || pendingDrop || activeCount() >= MAX_ACTIVE) return;
    const usableImages = images.filter(card => !failedImages.has(card.id));
    const hasText = entries.some(entry => entry.surface.card.type === "text");
    const kind = schedule.next(hasText, usableImages.length > 0);
    if (!kind) return;
    if (kind === "star") {
      if (star.flight.state !== "waiting") return;
      star.flight.reset(layout, random, warm); star.sync(layout);
      schedule.record(kind); options.onDrop?.({ kind }); return;
    }
    pendingDrop = true;
    try {
      let entry: Entry | undefined;
      if (kind === "text") {
        const textPages = entries.filter(entry => entry.surface.card.type === "text");
        entry = textPages[nextTextIndex % textPages.length];
        if (entry.flight.state !== "waiting") return;
      } else {
        const card = usableImages[nextImageIndex % usableImages.length];
        entry = entries.find(entry => entry.surface.card.id === card.id);
        if (entry && entry.flight.state !== "waiting") return;
        if (!entry) {
          try {
            const image = await loadCardImage(resolveImageSource(card.src));
            if (disposed || (!active && !warm)) { image.src = ""; return; }
            entry = addFrame(renderImageCard(card, image)[0], maskBase);
            entry.disposeImage = () => { image.src = ""; };
          } catch {
            if (!disposed) {
              failedImages.add(card.id);
              options.onError?.(new Error(`卡片 ${card.id} 的图片加载失败`));
            }
            return;
          }
        }
      }
      if (disposed || (!active && !warm)) return;
      entry.wasThrown = true;
      entry.zoom = entry.targetZoom = 1;
      entry.flight.reset(layout, random, warm);
      // Advance only after an actual drop; loading failures and pauses keep the
      // next slot. Each category completes its list before wrapping to the start.
      if (kind === "text") nextTextIndex++; else nextImageIndex++;
      schedule.record(kind); syncEntry(entry);
      options.onDrop?.({ kind, id: entry.surface.card.id });
    } finally { pendingDrop = false; }
  }

  function resize(width: number, height: number) {
    layout = layoutFor(width, height);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / (2 * PERSPECTIVE)));
    camera.setViewOffset(width, height, 0, height / 2 - layout.perspectiveY, width, height);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    for (const entry of entries) {
      const width = layout.cardWidth * (entry.surface.card.type === "image" ? 0.5 : 1);
      if (entry.width === width) continue;
      const geometry = entry.mesh.geometry;
      geometry.dispose(); resources.splice(resources.indexOf(geometry), 1);
      entry.width = width; entry.height = width * entry.surface.height / entry.surface.width;
      const depth = entry.surface.card.type === "image" ? 8 : 16;
      entry.mesh.geometry = new THREE.BoxGeometry(entry.width, entry.height, depth).translate(0, 0, -depth / 2);
      resources.push(entry.mesh.geometry);
      entry.vanish.size.value.set(entry.width, entry.height);
    }
    syncEntries();
  }

  function setTheme(value: "day" | "night") {
    if (theme === value) return;
    theme = value;
    reverse.image = renderCardReverse(theme); reverse.needsUpdate = true;
    sideMaterial.color.set(theme === "night" ? "#242830" : "#c8c0b2");
    entries.forEach(entry => {
      entry.vanish.paper.value.set(theme === "day" ? "#fafaf7" : "#050510");
      releaseTexture(entry);
    });
    syncEntries();
  }

  function drag(ndc: THREE.Vector2) {
    pointer.x = (ndc.x + 1) * layout.width / 2;
    pointer.y = (1 - ndc.y) * layout.height / 2;
  }

  function release() {
    if (!dragged) return;
    dragged.flight.state = "vanishing"; dragged.flight.vanishAge = 0; dragged = undefined;
  }

  function zoomHeld(deltaPixels: number) {
    if (!dragged) return undefined;
    dragged.targetZoom = THREE.MathUtils.clamp(dragged.targetZoom * Math.exp(-deltaPixels * 0.0015), 0.5, 3);
    return dragged.targetZoom;
  }

  function pick(ndc: THREE.Vector2) {
    if (!active || !ready) return undefined;
    raycaster.setFromCamera(ndc, camera); scene.updateMatrixWorld(true);
    const candidates = entries.filter(entry => entry.mesh.visible && entry.flight.state === "flying");
    const hit = raycaster.intersectObjects(candidates.map(entry => entry.mesh), false)[0];
    return hit ? candidates.find(entry => entry.mesh === hit.object) : undefined;
  }

  function beginDrag(ndc: THREE.Vector2) {
    const entry = pick(ndc);
    if (!entry) return false;
    drag(ndc); dragged = entry; entry.flight.state = "dragging"; return true;
  }

  function update(delta: number, visible: boolean, reducedMotion: boolean) {
    if (disposed) return;
    if (!visible && active) release();
    active = visible;
    if (!ready || !active || document.hidden) { accumulator = 0; return; }
    accumulator += Math.min(delta, 0.1);
    while (accumulator >= STEP) {
      accumulator -= STEP;
      if (!reducedMotion) simTime += STEP;
      for (const entry of entries) {
        if (!reducedMotion || entry.flight.state === "dragging" || entry.flight.state === "vanishing") {
          entry.flight.tick({ x: pointer.x - layout.smileX, y: pointer.y - layout.originY }, flightSpeed);
          entry.zoom += (entry.targetZoom - entry.zoom) * 0.25;
        }
      }
      if (!reducedMotion) star.flight.tick(undefined, flightSpeed);
      if (!reducedMotion && simTime >= nextThrow) {
        void throwOne(); nextThrow = simTime + (0.5 + random() * 0.5) * (layout.width > 767 ? 1.25 : 2) / flightSpeed;
      }
    }
    syncEntries();
  }

  function render() {
    if (!ready || !active || disposed) return;
    const previous = renderer.autoClear;
    try { renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, camera); }
    finally { renderer.autoClear = previous; }
  }

  async function initialize() {
    if (!options.cards) catalogIssues.forEach(issue => options.onError?.(new Error(issue)));
    let maskCanvas: HTMLCanvasElement;
    try { maskCanvas = makeMask(await loadCardImage(maskUrl)); }
    catch (error) {
      if (disposed) return;
      options.onError?.(error);
      maskCanvas = document.createElement("canvas"); maskCanvas.width = 30; maskCanvas.height = 1;
      const ctx = maskCanvas.getContext("2d")!; ctx.fillStyle = "white"; ctx.fillRect(0, 0, 30, 1);
    }
    if (disposed) return;
    maskBase = new THREE.CanvasTexture(maskCanvas);
    maskBase.repeat.set(1 / 30, 1); maskBase.minFilter = THREE.LinearFilter;
    maskBase.magFilter = THREE.LinearFilter; maskBase.generateMipmaps = false;
    resources.push(maskBase);
    for (const card of definitions) {
      if (card.type === "text") for (const page of renderTextCard(card)) addFrame(page, maskBase);
    }
    setTheme(theme);
    await throwOne(true);
    if (disposed) return;
    ready = true; options.onReady?.();
    // Warm the first text/photo pair only. Later photos decode on demand.
    void throwOne(true);
  }

  function dispose() {
    if (disposed) return;
    disposed = true; dragged = undefined;
    entries.forEach(entry => entry.disposeImage?.());
    resources.forEach(resource => resource.dispose()); resources.length = 0;
    entries.length = 0; scene.clear();
  }

  resize(options.width, options.height);
  void initialize().catch(error => { if (!disposed) options.onError?.(error); });
  return { resize, setTheme, update, render, pick, beginDrag, drag, release, zoomHeld, isInteracting: () => !!dragged, isStarVisible: () => star.mesh.visible, dispose };
}

export type HomeCardFlight = ReturnType<typeof createHomeCardFlight>;
