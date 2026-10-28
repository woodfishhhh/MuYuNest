import * as THREE from "three";
import type { StarClockView } from "./star-clock";
import { createStarClusters, type ClusterSettings } from "./star-clusters";
import { createHomeStarMotion, HOME_STAR_SETTINGS, HOME_STAR_SEED } from "./home-star-motion";
import type { StarMotionSettings } from "./star-motion";

export const STAR_FIELD_BACK_Z = -40;
export const STAR_FIELD_FRONT_Z = 8;
const STAR_FIELD_DEPTH = STAR_FIELD_FRONT_Z - STAR_FIELD_BACK_Z;
// Einstein radius of the pointer lens, in half-viewport-height units.
export const STAR_LENS_RADIUS = 0.09;
// Depth over which warped stars fade at each wrap plane.
const STAR_WRAP_FADE_DEPTH = 6;
// Fully fade the wrap planes from a quarter of full warp; slow drift barely wraps.
const STAR_WRAP_FADE_GAIN = 4;

const STAR_VERTEX_PARS = /* glsl */ `
attribute float starOpacity;
attribute float starSize;
varying float vStarOpacity;
uniform vec2 uLensCenter;
uniform float uLensStrength;
uniform float uLensAspect;
uniform float uWarpFade;
`;

// Runs after <project_vertex>. Everything here is per-vertex GPU work, so the
// lens costs no CPU time regardless of the star count.
const STAR_LENS_VERTEX = /* glsl */ `
// Warped stars jump between the far and near wrap planes (local z). Fading
// them near both planes keeps them from popping in front of the camera.
float starWrapFade = smoothstep(${STAR_FIELD_BACK_Z.toFixed(1)}, ${(STAR_FIELD_BACK_Z + STAR_WRAP_FADE_DEPTH).toFixed(1)}, transformed.z)
  * (1.0 - smoothstep(${(STAR_FIELD_FRONT_Z - STAR_WRAP_FADE_DEPTH).toFixed(1)}, ${STAR_FIELD_FRONT_Z.toFixed(1)}, transformed.z));
vStarOpacity *= mix(1.0, starWrapFade, uWarpFade);
float starLensGain = 1.0;
if (uLensStrength > 0.001 && gl_Position.w > 0.0) {
  vec2 lensAxis = vec2(uLensAspect, 1.0);
  vec2 lensOffset = (gl_Position.xy / gl_Position.w - uLensCenter) * lensAxis;
  float lensBeta = length(lensOffset);
  float lensEinstein = ${STAR_LENS_RADIUS.toFixed(3)} * uLensStrength;
  // Primary image of a point-mass lens: stars part around the pointer and
  // crowd onto an Einstein ring, leaving distant stars almost untouched.
  float lensTheta = 0.5 * (lensBeta + sqrt(lensBeta * lensBeta + 4.0 * lensEinstein * lensEinstein));
  vec2 lensDirection = lensBeta > 1e-5 ? lensOffset / lensBeta : vec2(0.0, 1.0);
  gl_Position.xy = (uLensCenter + lensDirection * lensTheta / lensAxis) * gl_Position.w;
  float lensU = lensBeta / lensEinstein;
  float lensMagnification = (lensU * lensU + 2.0) / max(lensU * sqrt(lensU * lensU + 4.0), 1e-3);
  starLensGain = min(sqrt(lensMagnification), 1.8);
}
`;

function wrapStarZ(value: number) {
  if (value >= STAR_FIELD_BACK_Z && value <= STAR_FIELD_FRONT_Z) {
    return value;
  }

  return (
    STAR_FIELD_BACK_Z +
    THREE.MathUtils.euclideanModulo(value - STAR_FIELD_BACK_Z, STAR_FIELD_DEPTH)
  );
}

export interface StarField {
  group: THREE.Group;
  setColor: (color: THREE.ColorRepresentation, blending?: THREE.Blending) => void;
  setOpacity: (alpha: number) => void;
  /** Signed: positive flies toward the camera, negative backs away. */
  setWarpIntensity: (value: number) => void;
  /** Bends stars around `center` (NDC); strength 0 disables the lens. */
  setLens: (center: THREE.Vector2, strength: number, aspect: number) => void;
  setCollectMode: (active: boolean, reducedMotion?: boolean) => void;
  update: (delta: number, view?: StarClockView) => void;
  dispose: () => void;
}

export function useStarField(circleTexture: THREE.CanvasTexture, count = 5000, settings: StarMotionSettings | ClusterSettings | null = HOME_STAR_SETTINGS): StarField {
  const group = new THREE.Group();
  group.rotation.set(0, 0, Math.PI / 4);

  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 40 * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = wrapStarZ(r * Math.cos(phi));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const starOpacity = new Float32Array(count).fill(1);
  geometry.setAttribute("starOpacity", new THREE.BufferAttribute(starOpacity, 1).setUsage(THREE.DynamicDrawUsage));
  const starSizes = new Float32Array(count).fill(1);
  geometry.setAttribute("starSize", new THREE.BufferAttribute(starSizes, 1).setUsage(THREE.DynamicDrawUsage));
  const clusters = settings
    ? "count" in settings
      ? createHomeStarMotion(positions, starOpacity, starSizes, settings)
      : createStarClusters(positions, starOpacity, starSizes, HOME_STAR_SEED, settings)
    : null;
  let collectActive = false;
  let reducedMotion = false;

  const material = new THREE.PointsMaterial({
    color: 0xfcfcfc,
    size: 0.05,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    map: circleTexture,
    alphaTest: 0.1,
    blending: THREE.AdditiveBlending,
  });
  const starUniforms = {
    uLensCenter: { value: new THREE.Vector2() },
    uLensStrength: { value: 0 },
    uLensAspect: { value: 1 },
    uWarpFade: { value: 0 },
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, starUniforms);
    shader.vertexShader = STAR_VERTEX_PARS + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvStarOpacity = starOpacity;");
    shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n" + STAR_LENS_VERTEX);
    shader.vertexShader = shader.vertexShader.replace("gl_PointSize = size;", "gl_PointSize = size * starSize * starLensGain;");
    shader.fragmentShader = "varying float vStarOpacity;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <alphatest_fragment>", "diffuseColor.a *= vStarOpacity;\n#include <alphatest_fragment>");
  };

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  group.add(points);

  let warpIntensity = 0;

  function setColor(
    color: THREE.ColorRepresentation,
    blending: THREE.Blending = THREE.NormalBlending,
  ) {
    material.color.set(color);
    material.blending = blending;
    material.needsUpdate = true;
  }

  function setOpacity(alpha: number) {
    material.opacity = THREE.MathUtils.clamp(alpha, 0, 1);
  }

  function setWarpIntensity(value: number) {
    warpIntensity = THREE.MathUtils.clamp(value, -1, 1);
  }

  function setLens(center: THREE.Vector2, strength: number, aspect: number) {
    starUniforms.uLensCenter.value.copy(center);
    starUniforms.uLensStrength.value = THREE.MathUtils.clamp(strength, 0, 1);
    starUniforms.uLensAspect.value = aspect > 0 ? aspect : 1;
  }

  function setCollectMode(active: boolean, reduced = false) {
    reducedMotion = reduced;
    collectActive = active;
  }

  function update(delta: number, view?: StarClockView) {
    const intensity = warpIntensity;
    const magnitude = Math.abs(intensity);
    if (!reducedMotion) group.rotation.z -= delta * (1 / 55 + magnitude / 20);
    starUniforms.uWarpFade.value = Math.min(1, magnitude * STAR_WRAP_FADE_GAIN);

    if (intensity !== 0) {
      const speed = 34 * intensity * delta;
      for (let i = 2; i < positions.length; i += 3) {
        const array = clusters?.sourceFor((i - 2) / 3) ?? positions;
        array[i] += speed;
        if (array[i] > STAR_FIELD_FRONT_Z || array[i] < STAR_FIELD_BACK_Z) array[i] = wrapStarZ(array[i]);
      }
      geometry.attributes.position.needsUpdate = true;
      material.size = 0.05 + magnitude * 0.025;
    } else if (material.size !== 0.05) {
      material.size = 0.05;
    }
    if (view && clusters?.update(delta, collectActive, group, view, reducedMotion)) {
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.starOpacity.needsUpdate = true;
      geometry.attributes.starSize.needsUpdate = true;
    }
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { group, setColor, setOpacity, setWarpIntensity, setLens, setCollectMode, update, dispose };
}
