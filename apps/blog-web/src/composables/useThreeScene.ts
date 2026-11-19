import * as THREE from "three";

export interface ThreeSceneOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  backgroundColor?: string;
  transparentBackground?: boolean;
}

export interface ThreeScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize: (width: number, height: number) => void;
  render: () => void;
  dispose: () => void;
}

export function useThreeScene(options: ThreeSceneOptions): ThreeScene {
  const background = options.backgroundColor ?? "#050510";
  const backgroundAlpha = options.transparentBackground ? 0 : 1;

  const renderer = new THREE.WebGLRenderer({
    canvas: options.canvas,
    antialias: true,
    alpha: options.transparentBackground ?? false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(options.width, options.height);
  renderer.setClearColor(new THREE.Color(background), backgroundAlpha);

  const scene = new THREE.Scene();
  scene.background = options.transparentBackground ? null : new THREE.Color(background);

  // No lights: every scene material is unlit (basic, points, lines, custom
  // shaders), and lights would only add per-frame light setup to each render.
  const camera = new THREE.PerspectiveCamera(75, options.width / options.height, 0.1, 1000);

  function resize(width: number, height: number) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function render() {
    renderer.render(scene, camera);
  }

  function dispose() {
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { renderer, scene, camera, resize, render, dispose };
}
