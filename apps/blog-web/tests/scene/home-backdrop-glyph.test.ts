import * as THREE from "three";
import { describe, expect, it } from "vite-plus/test";

import {
  createHomeBackdropGlyph,
  normalizeHomeBackdropSvg,
} from "@/components/scene/home-backdrop-glyph";

const RECT_PREFIX =
  "M0 0 C506.88 0 1013.76 0 1536 0 C1536 337.92 1536 675.84 1536 1024 C1029.12 1024 522.24 1024 0 1024 C0 686.08 0 348.16 0 0 Z";

describe("home backdrop glyph", () => {
  it("removes the full-svg fill rectangle and keeps glyph paths tintable", () => {
    const svg = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><path d="${RECT_PREFIX} M10 10 C11 11 12 12 13 13 Z" fill="#000000"/><path d="M1 1 Z" fill="#000000"/></svg>`;

    const normalized = normalizeHomeBackdropSvg(svg);

    expect(normalized).toContain('viewBox="0 0 1536 1024"');
    expect(normalized).not.toContain(RECT_PREFIX);
    expect(normalized).toContain('fill="#ffffff"');
  });

  it("renders after the depth-only occluder so the active geometry can hide it", () => {
    const texture = new THREE.Texture();
    const glyph = createHomeBackdropGlyph({ texture, theme: "day" });
    const mesh = glyph.group.children[0] as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial
    >;

    expect(mesh.renderOrder).toBeGreaterThan(70);
    expect(mesh.position.z).toBeLessThan(0);
    expect(mesh.material.depthTest).toBe(true);
    expect(mesh.material.depthWrite).toBe(false);
    expect(mesh.material.transparent).toBe(true);
    expect(mesh.material.alphaTest).toBeGreaterThan(0);
    expect(mesh.material.opacity).toBeGreaterThan(0.1);

    glyph.setTheme("night");

    expect(mesh.material.opacity).toBeLessThan(0.12);

    glyph.dispose();
  });
});
