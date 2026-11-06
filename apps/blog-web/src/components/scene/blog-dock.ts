import * as THREE from "three";

export interface DockRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Camera-space placement keeps the small geometry attached to the navigation,
// even while the scene camera is settling or responding to the pointer.
export function getBlogDockTransform(
  camera: THREE.PerspectiveCamera,
  viewport: DockRect,
  anchor: DockRect,
  geometryDiameter: number,
  progress = 1,
) {
  const distance = 12;
  const worldPerPixel = (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
    Math.max(viewport.height, 1);
  const x = anchor.left + anchor.width / 2 - viewport.left - viewport.width / 2;
  const y = viewport.height / 2 - (anchor.top + anchor.height / 2 - viewport.top);
  const position = new THREE.Vector3(x * worldPerPixel, y * worldPerPixel, -distance)
    .applyMatrix4(camera.matrixWorld);
  return {
    position,
    // Compensate off-axis perspective. For a local vertex (u, v, z),
    // x = u + anchorX * (1 - z / distance), so projecting it produces
    // exactly the centered view translated to the anchor on screen.
    projectionCorrection: new THREE.Matrix4().set(
      1, 0, -x * worldPerPixel / distance * progress, 0,
      0, 1, -y * worldPerPixel / distance * progress, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ),
    scale: (Math.min(anchor.width, anchor.height) * 1.2 * worldPerPixel) /
      Math.max(geometryDiameter, 0.001),
  };
}
