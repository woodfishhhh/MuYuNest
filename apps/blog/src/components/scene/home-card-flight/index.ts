import * as THREE from "three";
import { catalog, catalogIssues, resolveImageSource } from "./catalog";
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
  const reverse = new THREE.CanvasTexture(renderCardReverse());
  reverse.colorSpace = THREE.SRGBColorSpace;
  const backMaterial = new THREE.MeshBasicMaterial({ map: reverse });
  const sideMaterial = new THREE.MeshBasicMaterial({ color: "#c8c0b2" });
  const hiddenMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  blank.colorSpace = THREE.SRGBColorSpace;
  blank.needsUpdate = true;
  const resources: { dispose(): void }[] = [reverse, blank, backMaterial, sideMaterial, hiddenMaterial];

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
    const index = entries.length;
    const height = layout.cardWidth * surface.height / surface.width;
    // Clones share the mask image/GPU source; only their UV offsets differ.
    const mask = maskBase.clone();
    const front = new THREE.MeshBasicMaterial({ map: blank, alphaMap: mask, alphaTest: 0.5 });
    const vanish = { enabled: { value: 0 }, shift: { value: 0 },
      size: { value: new THREE.Vector2(layout.cardWidth, height) }, paper: { value: new THREE.Color("#fafaf7") } };
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
    const geometry = new THREE.BoxGeometry(layout.cardWidth, height, 16).translate(0, 0, -8);
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.visible = false;
    mesh.userData.cardId = surface.card.id;
    mesh.userData.page = surface.page;
    scene.add(mesh);
    entries.push({ flight: new Flight(index), surface, mesh, width: layout.cardWidth, height, materials, front, mask, vanish });
    resources.push(mask, front, geometry);
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
      const texture = new THREE.CanvasTexture(entry.surface.render());
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      entry.liveTexture = texture; entry.front.map = texture; resources.push(texture);
    }
    mesh.position.set(f.x, layout.perspectiveY - layout.originY - f.y, f.z);
    mesh.rotation.set(-f.rx * Math.PI / 180, f.ry * Math.PI / 180, -f.rz * Math.PI / 180, "XYZ");
    mesh.scale.setScalar(f.s);
    const frame = f.state === "vanishing" ? Math.min(29, Math.floor(f.vanishAge / 0.75 * 29)) : 0;
    entry.mask.offset.x = frame / 30;
    entry.vanish.enabled.value = f.state === "vanishing" ? 1 : 0;
    const outerFrame = Math.min(29, Math.floor(Math.max(0, f.vanishAge - 0.105) / 0.75 * 29));
    entry.vanish.shift.value = (outerFrame - frame) / 30;
    mesh.material = f.state === "dragging" || f.state === "vanishing"
      ? [hiddenMaterial, hiddenMaterial, hiddenMaterial, hiddenMaterial, entry.front, hiddenMaterial]
      : entry.materials;
  }

  function throwOne(warm = false) {
    if (entries.filter(entry => entry.flight.state !== "waiting").length >= MAX_ACTIVE) return;
    const available = entries.filter(entry => entry.flight.state === "waiting");
    if (available.length) available[Math.floor(random() * available.length)].flight.reset(layout, random, warm);
  }

  function resize(width: number, height: number) {
    layout = layoutFor(width, height);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / (2 * PERSPECTIVE)));
    camera.setViewOffset(width, height, 0, height / 2 - layout.perspectiveY, width, height);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    for (const entry of entries) {
      if (entry.width === layout.cardWidth) continue;
      const geometry = entry.mesh.geometry;
      geometry.dispose(); resources.splice(resources.indexOf(geometry), 1);
      entry.width = layout.cardWidth; entry.height = layout.cardWidth * entry.surface.height / entry.surface.width;
      entry.mesh.geometry = new THREE.BoxGeometry(entry.width, entry.height, 16).translate(0, 0, -8);
      resources.push(entry.mesh.geometry);
      entry.vanish.size.value.set(entry.width, entry.height);
    }
    entries.forEach(syncEntry);
  }

  function setTheme(value: "day" | "night") {
    theme = value;
    entries.forEach(entry => entry.vanish.paper.value.set(theme === "day" ? "#fafaf7" : "#050510"));
  }

  function drag(ndc: THREE.Vector2) {
    pointer.x = (ndc.x + 1) * layout.width / 2;
    pointer.y = (1 - ndc.y) * layout.height / 2;
  }

  function release() {
    if (!dragged) return;
    dragged.flight.state = "vanishing"; dragged.flight.vanishAge = 0; dragged = undefined;
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
        }
      }
      if (!reducedMotion && simTime >= nextThrow) {
        throwOne(); nextThrow = simTime + (0.5 + random() * 0.5) * (layout.width > 767 ? 1.25 : 2) / flightSpeed;
      }
    }
    entries.forEach(syncEntry);
  }

  function render() {
    if (!ready || !active || disposed) return;
    const previous = renderer.autoClear;
    try { renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, camera); }
    finally { renderer.autoClear = previous; }
  }

  function refreshReady() {
    if (disposed) return;
    setTheme(theme);
    for (let i = 0; i < MAX_ACTIVE; i++) throwOne(true);
    entries.forEach(syncEntry);
    if (!ready) { ready = true; options.onReady?.(); }
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
    const maskBase = new THREE.CanvasTexture(maskCanvas);
    maskBase.repeat.set(1 / 30, 1); maskBase.minFilter = THREE.LinearFilter;
    maskBase.magFilter = THREE.LinearFilter; maskBase.generateMipmaps = false;
    resources.push(maskBase);
    for (const card of definitions) if (card.type === "text") renderTextCard(card).forEach(page => addFrame(page, maskBase));
    const images = definitions.filter(card => card.type === "image");
    if (entries.length || !images.length) refreshReady();
    // Broken/CORS-blocked images do not block poetry or other images.
    await Promise.all(images.map(async card => {
      try {
        const image = await loadCardImage(resolveImageSource(card.src));
        if (disposed) return;
        renderImageCard(card, image).forEach(page => addFrame(page, maskBase)); refreshReady();
      } catch (error) {
        if (!disposed) options.onError?.(new Error(`卡片 ${card.id} 的图片加载失败：${String(error)}`));
      }
    }));
    if (!ready) refreshReady();
  }

  function dispose() {
    if (disposed) return;
    disposed = true; dragged = undefined;
    resources.forEach(resource => resource.dispose()); resources.length = 0;
    entries.length = 0; scene.clear();
  }

  resize(options.width, options.height);
  void initialize().catch(error => { if (!disposed) options.onError?.(error); });
  return { resize, setTheme, update, render, pick, beginDrag, drag, release, isInteracting: () => !!dragged, dispose };
}

export type HomeCardFlight = ReturnType<typeof createHomeCardFlight>;
