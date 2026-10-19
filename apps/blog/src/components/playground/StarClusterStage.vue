<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as THREE from "three";
import { useThreeScene, type ThreeScene } from "@/composables/useThreeScene";
import { useStarField, type StarField } from "@/composables/useStarField";
import { useHypercube, type Hypercube } from "@/composables/useHypercube";
import { useMobiusStrip, type MobiusStrip } from "@/composables/useMobiusStrip";
import { createCircleTexture } from "@/components/scene/circle-texture";
import { getBlogDockTransform } from "@/components/scene/blog-dock";
import { getHomeGeometryAnchor } from "@/components/scene/home-card-flight/layout";
import type { HomeCardFlight } from "@/components/scene/home-card-flight";
import { createStarClusters, type ClusterSettings } from "./star-clusters";

const props = defineProps<{ settings: ClusterSettings; collect: boolean; paused: boolean; theme: "day" | "night"; geometry: "cube" | "mobius"; cards: boolean; seed: number }>();
const emit = defineEmits<{ error: [message: string] }>();
const canvas = ref<HTMLCanvasElement>();
const dragging = ref(false);
const hovered = ref(false);
let scene: ThreeScene | undefined;
let stars: StarField | undefined;
let cube: Hypercube | undefined;
let mobius: MobiusStrip | undefined;
let texture: THREE.CanvasTexture | undefined;
let motion: ReturnType<typeof createStarClusters> | undefined;
let cards: HomeCardFlight | undefined;
let loadingCards = false;
let disposed = false;
let frame = 0;
let previous = 0;
let width = 1; let height = 1;
let observer: ResizeObserver | undefined;
let reduceQuery: MediaQueryList | undefined;
let reduced = false;
const pointer = new THREE.Vector2();
const smoothPointer = new THREE.Vector2();
const root = new THREE.Group();
const color = new THREE.Color();

function styleScene() {
  if (!scene || !stars || !cube || !mobius) return;
  const day = props.theme === "day";
  scene.renderer.setClearColor(day ? "#f8f7f2" : "#060812");
  scene.scene.background = new THREE.Color(day ? "#f8f7f2" : "#060812");
  stars.setColor(day ? "#111111" : "#fcfcfc", day ? THREE.NormalBlending : THREE.AdditiveBlending);
  stars.setOpacity(1);
  color.set(day ? "#333842" : "#e6e9f3"); cube.lerpColor(color, 1); mobius.lerpColor(color, 1);
  cube.group.visible = props.geometry === "cube"; mobius.group.visible = props.geometry === "mobius";
  cards?.setTheme(props.theme);
}

function resize() {
  if (!canvas.value || !scene) return;
  const bounds = canvas.value.getBoundingClientRect();
  width = bounds.width; height = bounds.height;
  scene.resize(width, height); cards?.resize(width, height);
  scene.camera.updateMatrixWorld();
  const viewport = { left: 0, top: 0, width, height };
  const target = getBlogDockTransform(scene.camera, viewport, getHomeGeometryAnchor(viewport), props.geometry === "cube" ? 10 : 6);
  root.position.copy(target.position); root.scale.setScalar(target.scale);
  cube?.setPointScale(target.scale);
}

async function ensureCards() {
  if (!props.cards || cards || loadingCards || !scene) return;
  loadingCards = true;
  try {
    const { createHomeCardFlight } = await import("@/components/scene/home-card-flight");
    if (disposed || !scene) return;
    cards = createHomeCardFlight({ renderer: scene.renderer, width, height, theme: props.theme,
      onError: () => emit("error", "部分卡片未能加载，可以继续试调星簇。") });
  } catch { if (!disposed) emit("error", "卡片加载失败，请刷新后重试。"); }
  finally { loadingCards = false; }
}

function move(event: PointerEvent) {
  const bounds = canvas.value!.getBoundingClientRect();
  pointer.set((event.clientX - bounds.left) / width * 2 - 1, 1 - (event.clientY - bounds.top) / height * 2);
  if (dragging.value) cards?.drag(pointer);
  hovered.value = !!cards?.pick(pointer);
}
function down(event: PointerEvent) {
  move(event);
  if (event.button === 0 && props.cards && props.collect && cards?.beginDrag(pointer)) {
    dragging.value = true; canvas.value?.setPointerCapture(event.pointerId);
  }
}
function release() { cards?.release(); dragging.value = false; }
function leave() { if (!dragging.value) { pointer.set(0, 0); hovered.value = false; } }
function setReduced(event: MediaQueryListEvent) { reduced = event.matches; }
function replay() { motion?.replay(); }
defineExpose({ replay });

watch(() => [props.settings, props.seed] as const, () => motion?.configure(props.settings, props.seed), { deep: true });
watch(() => [props.theme, props.geometry], () => { styleScene(); resize(); });
watch(() => props.cards, () => { if (!props.cards) release(); void ensureCards(); });
watch(() => props.collect, value => { if (!value) release(); });

onMounted(() => {
  try {
    scene = useThreeScene({ canvas: canvas.value!, width: 1, height: 1 });
    scene.camera.position.set(0, 0, 10); scene.camera.lookAt(0, 0, 0);
    texture = createCircleTexture(); stars = useStarField(texture, 5000, null);
    const points = stars.group.children[0] as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
    const positions = points.geometry.attributes.position.array as Float32Array;
    const alpha = points.geometry.attributes.starOpacity.array as Float32Array;
    const sizes = points.geometry.attributes.starSize.array as Float32Array;
    motion = createStarClusters(positions, alpha, sizes, props.seed, props.settings);
    cube = useHypercube(texture); mobius = useMobiusStrip();
    root.add(cube.group, mobius.group); scene.scene.add(stars.group, root);
    styleScene(); resize(); void ensureCards();
    observer = new ResizeObserver(resize); observer.observe(canvas.value!);
    reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)"); reduced = reduceQuery.matches;
    reduceQuery.addEventListener("change", setReduced);

    function tick(now: number) {
      if (!scene || !stars || !cube || !mobius || !motion) return;
      const rawDelta = Math.min((now - (previous || now)) / 1000, 0.05); previous = now;
      const delta = props.paused || reduced || document.hidden ? 0 : rawDelta;
      if (!props.paused && !reduced) smoothPointer.lerp(pointer, 1 - Math.exp(-rawDelta * 3));
      stars.setCollectMode(false, reduced || props.paused); stars.update(delta);
      motion.update(delta, props.collect, stars.group, { camera: scene.camera, width, height, pointer: smoothPointer }, reduced || props.paused);
      points.geometry.attributes.position.needsUpdate = true;
      points.geometry.attributes.starOpacity.needsUpdate = true;
      points.geometry.attributes.starSize.needsUpdate = true;
      const geometry = props.geometry === "cube" ? cube : mobius;
      geometry.update(delta); geometry.group.rotation.y += delta * 0.08;
      cards?.update(props.paused ? 0 : rawDelta, props.cards && props.collect, reduced);
      scene.render(); cards?.render();
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  } catch { emit("error", "3D 预览未能启动，请检查浏览器是否启用了 WebGL。"); }
});

onBeforeUnmount(() => {
  disposed = true; cancelAnimationFrame(frame); observer?.disconnect();
  reduceQuery?.removeEventListener("change", setReduced);
  cards?.dispose(); stars?.dispose(); cube?.dispose(); mobius?.dispose(); texture?.dispose(); scene?.dispose();
});
</script>

<template>
  <canvas ref="canvas" class="cluster-canvas" :class="{ grabbing: dragging, grab: hovered }" aria-label="可调节的星簇效果预览"
    @pointermove="move" @pointerdown="down" @pointerup="release" @pointercancel="release" @lostpointercapture="release" @pointerleave="leave" />
</template>

<style scoped>
.cluster-canvas { position: absolute; inset: 0; display: block; width: 100% !important; height: 100% !important; touch-action: none; }
.grab { cursor: grab; } .grabbing { cursor: grabbing; }
</style>
