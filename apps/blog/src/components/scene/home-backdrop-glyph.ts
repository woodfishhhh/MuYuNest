import * as THREE from "three";

import type { ThemeMode } from "@/composables/useTheme";
import { supportsContentLayout } from "@/utils/responsive";

interface HomeBackdropGlyphOptions {
  texture: THREE.Texture;
  theme: ThemeMode;
}

interface HomeBackdropGlyphViewport {
  height: number;
  width: number;
}

export interface HomeBackdropGlyph {
  group: THREE.Group;
  dispose: () => void;
  setTheme: (theme: ThemeMode) => void;
  updateViewport: (viewport: HomeBackdropGlyphViewport) => void;
}

export const HOME_BACKDROP_SVG_URL = "/asset/febfcb46944990d5a26ad7e9391a2d1e.svg";
export const HOME_BACKDROP_RENDER_ORDER = 86;

const SVG_WIDTH = 1536;
const SVG_HEIGHT = 1024;
const GLYPH_ASPECT = SVG_WIDTH / SVG_HEIGHT;
const GLYPH_Z = -1.45;
const DAY_GLYPH_COLOR = "#111827";
const NIGHT_GLYPH_COLOR = "#f6f8ff";
const DAY_GLYPH_OPACITY = 0.18;
const NIGHT_GLYPH_OPACITY = 0.11;
const FULL_RECT_PATH_PREFIX =
  "M0 0 C506.88 0 1013.76 0 1536 0 C1536 337.92 1536 675.84 1536 1024 C1029.12 1024 522.24 1024 0 1024 C0 686.08 0 348.16 0 0 Z";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeHomeBackdropSvg(svg: string) {
  return svg
    .replace(
      /<svg([^>]*?)width="1536" height="1024"([^>]*?)>/,
      '<svg$1width="1536" height="1024" viewBox="0 0 1536 1024"$2>',
    )
    .replace(new RegExp(`(<path\\s+d=")${escapeRegExp(FULL_RECT_PATH_PREFIX)}\\s+M`), "$1M")
    .replaceAll('fill="#000000"', 'fill="#ffffff"')
    .replaceAll('fill="#000"', 'fill="#ffffff"');
}

function applyTheme(material: THREE.MeshBasicMaterial, theme: ThemeMode) {
  const isDay = theme === "day";
  material.color.set(isDay ? DAY_GLYPH_COLOR : NIGHT_GLYPH_COLOR);
  material.opacity = isDay ? DAY_GLYPH_OPACITY : NIGHT_GLYPH_OPACITY;
}

function getGlyphWidth(viewport: HomeBackdropGlyphViewport) {
  return supportsContentLayout(viewport.width) ? 13.8 : 11.8;
}

export async function loadHomeBackdropTexture(): Promise<THREE.Texture> {
  const response = await fetch(HOME_BACKDROP_SVG_URL);
  if (!response.ok) throw new Error(`Failed to load home backdrop SVG: ${response.status}`);

  const svg = normalizeHomeBackdropSvg(await response.text());
  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return await new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      dataUri,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.premultiplyAlpha = true;
        resolve(texture);
      },
      undefined,
      reject,
    );
  });
}

export function createHomeBackdropGlyph({
  texture,
  theme,
}: HomeBackdropGlyphOptions): HomeBackdropGlyph {
  const group = new THREE.Group();
  group.name = "home-backdrop-glyph";

  const geometry = new THREE.PlaneGeometry(GLYPH_ASPECT, 1);
  const material = new THREE.MeshBasicMaterial({
    alphaTest: 0.02,
    color: 0xffffff,
    depthTest: true,
    depthWrite: false,
    map: texture,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "home-backdrop-glyph-plane";
  mesh.position.z = GLYPH_Z;
  mesh.renderOrder = HOME_BACKDROP_RENDER_ORDER;
  group.add(mesh);

  function updateViewport(viewport: HomeBackdropGlyphViewport) {
    const width = getGlyphWidth(viewport);
    mesh.scale.set(width, width / GLYPH_ASPECT, 1);
    mesh.position.y = supportsContentLayout(viewport.width) ? -0.08 : 0.08;
  }

  function dispose() {
    texture.dispose();
    geometry.dispose();
    material.dispose();
    group.clear();
  }

  applyTheme(material, theme);

  return {
    group,
    dispose,
    setTheme(nextTheme) {
      applyTheme(material, nextTheme);
    },
    updateViewport,
  };
}
