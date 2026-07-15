import * as THREE from "three";

export const STAR_FIELD_BACK_Z = -40;
export const STAR_FIELD_FRONT_Z = 8;
const STAR_FIELD_DEPTH = STAR_FIELD_FRONT_Z - STAR_FIELD_BACK_Z;

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
  setWarpIntensity: (value: number) => void;
  update: (delta: number) => void;
  dispose: () => void;
}

export function useStarField(circleTexture: THREE.CanvasTexture, count = 5000): StarField {
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
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

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
    warpIntensity = THREE.MathUtils.clamp(value, 0, 1);
  }

  function update(delta: number) {
    const intensity = THREE.MathUtils.clamp(warpIntensity, 0, 1);
    group.rotation.z -= delta * (1 / 55 + intensity / 20);

    if (intensity > 0) {
      const array = geometry.attributes.position.array as Float32Array;
      const speed = 34 * intensity * delta;
      for (let i = 2; i < array.length; i += 3) {
        array[i] += speed;
        if (array[i] > STAR_FIELD_FRONT_Z) array[i] = wrapStarZ(array[i]);
      }
      geometry.attributes.position.needsUpdate = true;
      material.size = 0.05 + intensity * 0.025;
    } else if (material.size !== 0.05) {
      material.size = 0.05;
    }
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { group, setColor, setOpacity, setWarpIntensity, update, dispose };
}
