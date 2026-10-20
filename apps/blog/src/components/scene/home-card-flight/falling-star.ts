import * as THREE from "three";
import { Flight, type Layout } from "./motion";

export function createFallingStar(index: number) {
  const shape = new THREE.Shape();
  const vertices = [[24.5, 0], [27.8, 21.2], [49, 24.5], [27.8, 27.8], [24.5, 49], [21.2, 27.8], [0, 24.5], [21.2, 21.2]];
  vertices.forEach(([x, y], i) => {
    const px = (x / 49 - 0.5) * 400;
    const py = (0.5 - y / 49) * 400;
    if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 20, bevelEnabled: true, bevelSize: 2, bevelThickness: 2, bevelSegments: 1, steps: 1 });
  geometry.translate(0, 0, -10);
  const face = new THREE.MeshBasicMaterial({ color: "#ede6d8" });
  const edge = new THREE.MeshBasicMaterial({ color: "#958a76" });
  const mesh = new THREE.Mesh(geometry, [face, edge]);
  mesh.visible = false;
  mesh.userData.kind = "star";
  const flight = new Flight(index);
  function sync(layout: Layout) {
    mesh.visible = flight.state !== "waiting";
    mesh.position.set(flight.x + layout.width * 0.15, layout.perspectiveY - layout.originY - flight.y, flight.z);
    mesh.rotation.set(-flight.rx * Math.PI / 180, flight.ry * Math.PI / 180, -flight.rz * Math.PI / 180);
    mesh.scale.setScalar(flight.s * flight.size * (layout.width > 767 ? 1 : 0.5));
  }
  return { mesh, flight, sync, dispose() { geometry.dispose(); face.dispose(); edge.dispose(); } };
}
