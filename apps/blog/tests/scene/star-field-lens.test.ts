import * as THREE from "three";
import { describe, expect, it } from "vite-plus/test";

import {
  STAR_FIELD_BACK_Z,
  STAR_FIELD_FRONT_Z,
  useStarField,
} from "@/composables/useStarField";

type CompiledShader = Parameters<THREE.Material["onBeforeCompile"]>[0];

function createField() {
  const texture = new THREE.CanvasTexture(document.createElement("canvas"));
  const field = useStarField(texture, 1, null);
  const points = field.group.children[0] as THREE.Points;
  const material = points.material as THREE.PointsMaterial;
  const positions = points.geometry.attributes.position.array as Float32Array;
  const dispose = () => {
    field.dispose();
    texture.dispose();
  };
  return { dispose, field, material, positions };
}

function compile(material: THREE.PointsMaterial) {
  const shader = {
    fragmentShader: THREE.ShaderLib.points.fragmentShader,
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.points.uniforms),
    vertexShader: THREE.ShaderLib.points.vertexShader,
  } as unknown as CompiledShader;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe("star field navigation warp", () => {
  it("backs stars away from the camera for negative warp", () => {
    const { dispose, field, positions } = createField();
    try {
      positions[2] = 0;
      field.setWarpIntensity(-0.5);
      field.update(0.1);

      expect(positions[2]).toBeCloseTo(-1.7, 5);
    } finally {
      dispose();
    }
  });

  it("wraps stars that back out past the far plane", () => {
    const { dispose, field, positions } = createField();
    try {
      positions[2] = STAR_FIELD_BACK_Z + 0.1;
      field.setWarpIntensity(-1);
      field.update(0.1);

      expect(positions[2]).toBeGreaterThanOrEqual(STAR_FIELD_BACK_Z);
      expect(positions[2]).toBeLessThanOrEqual(STAR_FIELD_FRONT_Z);
    } finally {
      dispose();
    }
  });

  it("fades stars at the wrap planes only while warping", () => {
    const { dispose, field, material } = createField();
    try {
      const shader = compile(material);
      expect(shader.vertexShader).toContain(
        `smoothstep(${STAR_FIELD_BACK_Z.toFixed(1)}, ${(STAR_FIELD_BACK_Z + 6).toFixed(1)}, transformed.z)`,
      );
      expect(shader.vertexShader).toContain(
        `smoothstep(${(STAR_FIELD_FRONT_Z - 6).toFixed(1)}, ${STAR_FIELD_FRONT_Z.toFixed(1)}, transformed.z)`,
      );

      field.setWarpIntensity(-0.1);
      field.update(0.016);
      expect(shader.uniforms.uWarpFade.value).toBeCloseTo(0.4);

      // Any real navigation pulse fades the planes completely.
      field.setWarpIntensity(-0.4);
      field.update(0.016);
      expect(shader.uniforms.uWarpFade.value).toBe(1);

      field.setWarpIntensity(0);
      field.update(0.016);
      expect(shader.uniforms.uWarpFade.value).toBe(0);
    } finally {
      dispose();
    }
  });

  it("backs stars out consistently while the home rays hold them", () => {
    const texture = new THREE.CanvasTexture(document.createElement("canvas"));
    // Default settings: the Home ray motion owns a copy of the source field.
    const field = useStarField(texture, 120);
    const positions = (field.group.children[0] as THREE.Points).geometry.attributes.position.array as Float32Array;
    const before = positions.slice();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 10;
    const view = { camera, width: 900, height: 900, pointer: new THREE.Vector2() };
    try {
      field.setWarpIntensity(-1);
      field.update(0.1, view);
      field.setCollectMode(true, true);
      field.update(0, view);
      field.update(0.1, view);
      field.setCollectMode(false, true);
      field.update(0, view);

      for (let i = 2; i < positions.length; i += 3) {
        const raw = before[i] - 6.8;
        const expected =
          raw < STAR_FIELD_BACK_Z
            ? STAR_FIELD_BACK_Z +
              THREE.MathUtils.euclideanModulo(raw - STAR_FIELD_BACK_Z, STAR_FIELD_FRONT_Z - STAR_FIELD_BACK_Z)
            : raw;
        expect(positions[i]).toBeCloseTo(expected, 4);
      }
    } finally {
      field.dispose();
      texture.dispose();
    }
  });
});

describe("star field pointer lens", () => {
  it("injects the lens after projection and scales point size by its gain", () => {
    const { dispose, material } = createField();
    try {
      const shader = compile(material);
      const projectIndex = shader.vertexShader.indexOf("#include <project_vertex>");
      const lensIndex = shader.vertexShader.indexOf("float starLensGain");

      expect(projectIndex).toBeGreaterThan(-1);
      expect(lensIndex).toBeGreaterThan(projectIndex);
      expect(shader.vertexShader).toContain("gl_PointSize = size * starSize * starLensGain;");
      expect(shader.fragmentShader).toContain("diffuseColor.a *= vStarOpacity;");
    } finally {
      dispose();
    }
  });

  it("drives the compiled shader uniforms without recompiling", () => {
    const { dispose, field, material } = createField();
    try {
      const shader = compile(material);
      const version = material.version;
      field.setLens(new THREE.Vector2(0.25, -0.5), 2, 16 / 9);

      expect(shader.uniforms.uLensCenter.value.toArray()).toEqual([0.25, -0.5]);
      expect(shader.uniforms.uLensStrength.value).toBe(1);
      expect(shader.uniforms.uLensAspect.value).toBeCloseTo(16 / 9);
      expect(material.version).toBe(version);

      field.setLens(new THREE.Vector2(), -1, 0);
      expect(shader.uniforms.uLensStrength.value).toBe(0);
      expect(shader.uniforms.uLensAspect.value).toBe(1);
    } finally {
      dispose();
    }
  });
});
