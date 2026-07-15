import * as THREE from "three";

export interface MobiusDataParams {
  segmentsU: number;
  segmentsV: number;
  radius: number;
  width: number;
}

export interface MobiusData {
  params: MobiusDataParams;
  positions: Float32Array;
  edges: number[];
  triangles: number[];
}

export interface MobiusStrip {
  group: THREE.Group;
  line: THREE.LineSegments;
  hitMesh: THREE.Mesh;
  occluder: THREE.Mesh;
  update: (delta: number) => void;
  lerpColor: (target: THREE.Color, factor: number) => void;
  setOpacity: (alpha: number) => void;
  setInteractionIntensity: (value: number) => void;
  dispose: () => void;
}

export const MOBIUS_ROTATION_SPEED = {
  y: 0.03,
  x: 0.01,
} as const;

const MOBIUS_RING_POSE = {
  x: 0.32,
  y: 0.36,
} as const;

function indexFor(segmentsV: number, u: number, v: number) {
  return u * segmentsV + v;
}

export function generateMobiusData(overrides: Partial<MobiusDataParams> = {}): MobiusData {
  const params: MobiusDataParams = {
    segmentsU: overrides.segmentsU ?? 84,
    segmentsV: overrides.segmentsV ?? 10,
    radius: overrides.radius ?? 2.3,
    width: overrides.width ?? 0.7,
  };
  const { segmentsU, segmentsV, radius, width } = params;

  const positions = new Float32Array(segmentsU * segmentsV * 3);
  const edges: number[] = [];
  const triangles: number[] = [];

  for (let u = 0; u < segmentsU; u++) {
    const theta = (u / segmentsU) * Math.PI * 2;
    const cosHalf = Math.cos(theta * 0.5);
    const sinHalf = Math.sin(theta * 0.5);
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    for (let v = 0; v < segmentsV; v++) {
      const t = segmentsV === 1 ? 0 : v / (segmentsV - 1);
      const offset = (t - 0.5) * width * 2;
      const ring = radius + offset * cosHalf;

      const x = ring * cosTheta;
      const y = ring * sinTheta;
      const z = offset * sinHalf;

      const index = indexFor(segmentsV, u, v) * 3;
      positions[index] = x;
      positions[index + 1] = y;
      positions[index + 2] = z;

      if (v < segmentsV - 1) {
        edges.push(indexFor(segmentsV, u, v), indexFor(segmentsV, u, v + 1));
      }
      const nextU = (u + 1) % segmentsU;
      const nextV = nextU === 0 ? segmentsV - 1 - v : v;
      edges.push(indexFor(segmentsV, u, v), indexFor(segmentsV, nextU, nextV));

      if (v < segmentsV - 1) {
        const nextVEdge = nextU === 0 ? segmentsV - 1 - (v + 1) : v + 1;
        const a = indexFor(segmentsV, u, v);
        const b = indexFor(segmentsV, u, v + 1);
        const c = indexFor(segmentsV, nextU, nextVEdge);
        const d = indexFor(segmentsV, nextU, nextV);
        triangles.push(a, d, c, a, c, b);
      }
    }
  }

  return { params, positions, edges, triangles };
}

function createDepthOnlyMaterial() {
  return new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
}

export function useMobiusStrip(): MobiusStrip {
  const { positions, edges, triangles } = generateMobiusData();
  const group = new THREE.Group();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(edges);

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x121212,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const line = new THREE.LineSegments(geometry, lineMaterial);
  line.renderOrder = 40;
  group.add(line);

  const occluderGeometry = new THREE.BufferGeometry();
  occluderGeometry.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
  occluderGeometry.setIndex(triangles);

  const hitMeshGeometry = new THREE.TorusGeometry(2.3, 0.72, 8, 32);
  const hitMeshMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitMeshGeometry, hitMeshMaterial);
  group.add(hitMesh);

  const occluderMaterial = createDepthOnlyMaterial();
  const occluder = new THREE.Mesh(occluderGeometry, occluderMaterial);
  occluder.name = "mobius-depth-occluder";
  occluder.renderOrder = 70;
  group.add(occluder);

  let interactionIntensity = 0;

  function update(delta: number) {
    const intensity = THREE.MathUtils.clamp(interactionIntensity, 0, 1);
    const normalMotion = 1 - intensity * 0.6;
    group.rotation.y += delta * MOBIUS_ROTATION_SPEED.y * normalMotion;
    group.rotation.x += delta * MOBIUS_ROTATION_SPEED.x * normalMotion;

    if (intensity <= 0) return;

    const poseAlpha = 1 - Math.exp(-delta * 10 * intensity);
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, MOBIUS_RING_POSE.x, poseAlpha);
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, MOBIUS_RING_POSE.y, poseAlpha);
    group.rotation.z += delta * (1.15 + intensity * 0.65) * intensity;

    const ribbonSpin = delta * 0.32 * intensity;
    line.rotation.z += ribbonSpin;
    hitMesh.rotation.copy(line.rotation);
    occluder.rotation.copy(line.rotation);
  }

  function lerpColor(target: THREE.Color, factor: number) {
    lineMaterial.color.lerp(target, factor);
  }

  function setOpacity(alpha: number) {
    lineMaterial.opacity = THREE.MathUtils.clamp(alpha, 0, 1);
  }

  function setInteractionIntensity(value: number) {
    interactionIntensity = THREE.MathUtils.clamp(value, 0, 1);
  }

  function dispose() {
    geometry.dispose();
    lineMaterial.dispose();
    hitMeshGeometry.dispose();
    hitMeshMaterial.dispose();
    occluderGeometry.dispose();
    occluderMaterial.dispose();
  }

  return {
    group,
    line,
    hitMesh,
    occluder,
    update,
    lerpColor,
    setOpacity,
    setInteractionIntensity,
    dispose,
  };
}
