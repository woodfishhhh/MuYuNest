import * as THREE from "three";

export interface HypercubeData {
  vertices: number[][];
  edges: number[];
}

const CUBE_FACE_QUADS = [
  [0, 1, 3, 2],
  [4, 5, 7, 6],
  [0, 1, 5, 4],
  [2, 3, 7, 6],
  [0, 2, 6, 4],
  [1, 3, 7, 5],
] as const;

export interface Hypercube {
  group: THREE.Group;
  line: THREE.LineSegments;
  points: THREE.Points;
  hitMesh: THREE.Mesh;
  occluder: THREE.Mesh;
  update: (delta: number) => void;
  lerpColor: (target: THREE.Color, factor: number) => void;
  setOpacity: (alpha: number) => void;
  setInteractionIntensity: (value: number) => void;
  dispose: () => void;
}

export const HYPERCUBE_PROJECTION_ROTATION_SPEED = {
  alpha: 0.03,
  beta: 0.01,
} as const;

export function generateHypercubeData(): HypercubeData {
  const vertices: number[][] = [];
  for (let i = 0; i < 16; i++) {
    const x = i & 1 ? 1 : -1;
    const y = i & 2 ? 1 : -1;
    const z = i & 4 ? 1 : -1;
    const w = i & 8 ? 1 : -1;
    vertices.push([x, y, z, w]);
  }
  const edges: number[] = [];
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 4; j++) {
      const neighbor = i ^ (1 << j);
      if (i < neighbor) {
        edges.push(i, neighbor);
      }
    }
  }
  return { vertices, edges };
}

export function generateHypercubeSurfaceIndices(vertices: number[][]) {
  const indices: number[] = [];

  for (let fixedAxis = 0; fixedAxis < 4; fixedAxis++) {
    for (const fixedSign of [-1, 1] as const) {
      const localToGlobal = Array.from<number>({ length: 8 });
      const remainingAxes = [0, 1, 2, 3].filter((axis) => axis !== fixedAxis);

      for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex++) {
        const vertex = vertices[vertexIndex];
        if (vertex[fixedAxis] !== fixedSign) {
          continue;
        }

        let localIndex = 0;
        remainingAxes.forEach((axis, bit) => {
          if (vertex[axis] > 0) {
            localIndex |= 1 << bit;
          }
        });
        localToGlobal[localIndex] = vertexIndex;
      }

      for (const [a, b, c, d] of CUBE_FACE_QUADS) {
        indices.push(
          localToGlobal[a],
          localToGlobal[b],
          localToGlobal[c],
          localToGlobal[a],
          localToGlobal[c],
          localToGlobal[d],
        );
      }
    }
  }

  return indices;
}

function createDepthOnlyMaterial() {
  return new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    transparent: true,
  });
}

function projectVertex(vertex: number[], alphaRot: number, betaRot: number) {
  const [x, y, z, w] = vertex;
  const cosA = Math.cos(alphaRot);
  const sinA = Math.sin(alphaRot);
  const cosB = Math.cos(betaRot);
  const sinB = Math.sin(betaRot);
  const x1 = x * cosA - w * sinA;
  const w1 = x * sinA + w * cosA;
  const z1 = z * cosB - w1 * sinB;
  const w2 = z * sinB + w1 * cosB;
  const distance = 2.5;
  const wZ = 1 / (distance - w2);

  return {
    x: x1 * wZ * 4,
    y: y * wZ * 4,
    z: z1 * wZ * 4,
  };
}

export function useHypercube(circleTexture: THREE.CanvasTexture): Hypercube {
  const { vertices, edges } = generateHypercubeData();
  const group = new THREE.Group();

  const hitGeom = new THREE.SphereGeometry(3.1, 16, 16);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeom, hitMat);
  group.add(hitMesh);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
  geometry.setIndex(edges);

  const occluderGeometry = new THREE.BufferGeometry();
  occluderGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
  occluderGeometry.setIndex(generateHypercubeSurfaceIndices(vertices));

  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const line = new THREE.LineSegments(geometry, lineMaterial);
  line.renderOrder = 40;
  group.add(line);

  const pointsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.15,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    map: circleTexture,
    alphaTest: 0.1,
  });
  const points = new THREE.Points(geometry, pointsMaterial);
  points.renderOrder = 45;
  group.add(points);

  const occluderMaterial = createDepthOnlyMaterial();
  const occluder = new THREE.Mesh(occluderGeometry, occluderMaterial);
  occluder.name = "hypercube-depth-occluder";
  occluder.renderOrder = 70;
  group.add(occluder);

  let alphaRot = 0;
  let betaRot = 0;
  let jitterTime = 0;
  let interactionIntensity = 0;

  function update(delta: number) {
    const intensity = THREE.MathUtils.clamp(interactionIntensity, 0, 1);
    const motion = 1 - intensity;
    jitterTime += delta;
    alphaRot += delta * HYPERCUBE_PROJECTION_ROTATION_SPEED.alpha * motion;
    betaRot += delta * HYPERCUBE_PROJECTION_ROTATION_SPEED.beta * motion;
    const positions = geometry.attributes.position.array as Float32Array;
    const occluderPositions = occluderGeometry.attributes.position.array as Float32Array;

    for (let i = 0; i < 16; i++) {
      const dynamic = projectVertex(vertices[i], alphaRot, betaRot);
      const base = projectVertex(vertices[i], 0, 0);
      const jitter = Math.sin(jitterTime * 8 + i * 1.7) * 0.024 * intensity;

      positions[i * 3] = THREE.MathUtils.lerp(dynamic.x, base.x + jitter, intensity);
      positions[i * 3 + 1] = THREE.MathUtils.lerp(dynamic.y, base.y - jitter, intensity);
      positions[i * 3 + 2] = THREE.MathUtils.lerp(dynamic.z, base.z + jitter, intensity);
      occluderPositions[i * 3] = positions[i * 3];
      occluderPositions[i * 3 + 1] = positions[i * 3 + 1];
      occluderPositions[i * 3 + 2] = positions[i * 3 + 2];
    }
    geometry.attributes.position.needsUpdate = true;
    occluderGeometry.attributes.position.needsUpdate = true;
  }

  function lerpColor(target: THREE.Color, factor: number) {
    lineMaterial.color.lerp(target, factor);
    pointsMaterial.color.lerp(target, factor);
  }

  function setOpacity(alpha: number) {
    const nextOpacity = THREE.MathUtils.clamp(alpha, 0, 1);
    lineMaterial.transparent = nextOpacity < 1;
    lineMaterial.opacity = nextOpacity;
    pointsMaterial.opacity = nextOpacity;
  }

  function setInteractionIntensity(value: number) {
    interactionIntensity = THREE.MathUtils.clamp(value, 0, 1);
  }

  function dispose() {
    hitGeom.dispose();
    hitMat.dispose();
    occluderGeometry.dispose();
    occluderMaterial.dispose();
    geometry.dispose();
    lineMaterial.dispose();
    pointsMaterial.dispose();
  }

  return {
    group,
    line,
    points,
    hitMesh,
    occluder,
    update,
    lerpColor,
    setOpacity,
    setInteractionIntensity,
    dispose,
  };
}
