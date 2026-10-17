<script lang="ts">
const expandedState = new Set<string>();
</script>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, useTemplateRef, watch } from "vue";
import gsap from "gsap";
import { reducedDocsMotion } from "@/motion/docs-motion";
import DocsCollapse from "./DocsCollapse.vue";
import { useRoute } from "vue-router";
import { findDocsPlacement, type DocsTopic } from "@/content/docs-navigation";

const props = defineProps<{ topics: DocsTopic[]; currentSlug?: string }>();
const emit = defineEmits<{ navigate: [] }>();
const route = useRoute();
const expanded = reactive(expandedState);
const tree = useTemplateRef<HTMLElement>("tree");
const marker = useTemplateRef<HTMLElement>("marker");
let resize: ResizeObserver | undefined;
let markerMotion: gsap.core.Tween | undefined;
function updateMarker() {
  const active = tree.value?.querySelector<HTMLElement>(".docs-tree__articles a.is-active");
  if (!marker.value) return;
  markerMotion?.kill();
  if (!active || !active.getClientRects().length) {
    gsap.set(marker.value, { opacity: 0 });
    return;
  }
  const bounds = active.getBoundingClientRect();
  const parent = tree.value!.getBoundingClientRect();
  const scaleX = parent.width / tree.value!.offsetWidth || 1;
  const scaleY = parent.height / tree.value!.offsetHeight || 1;
  const position = {
    x: (bounds.left - parent.left) / scaleX,
    y: (bounds.top - parent.top) / scaleY,
    width: bounds.width / scaleX,
    height: bounds.height / scaleY,
  };
  if (!marker.value.style.height) gsap.set(marker.value, position);
  markerMotion = gsap.to(marker.value, {
    ...position,
    opacity: 1,
    duration: reducedDocsMotion() ? 0 : 0.24,
    ease: "power3.out",
  });
}
watch(
  () => [props.currentSlug, props.topics, [...expanded].join(",")],
  async () => {
    await nextTick();
    updateMarker();
  },
  { flush: "post" },
);
onMounted(() => {
  if (typeof ResizeObserver !== "undefined" && tree.value) {
    resize = new ResizeObserver(updateMarker);
    resize.observe(tree.value);
  }
  tree.value?.closest(".docs-app")?.addEventListener("docs-motion-settled", updateMarker);
  updateMarker();
});
onBeforeUnmount(() => {
  tree.value?.closest(".docs-app")?.removeEventListener("docs-motion-settled", updateMarker);
  resize?.disconnect();
  markerMotion?.kill();
});
watch(
  () => [props.currentSlug, route.query.topic, route.query.series, props.topics] as const,
  () => {
    const placement = findDocsPlacement(props.topics, props.currentSlug ?? "");
    const topic = placement?.topic.id ?? String(route.query.topic ?? "");
    const group = placement?.group.id ?? String(route.query.series ?? "");
    if (topic) expanded.add(topic);
    if (group) expanded.add(group);
  },
  { immediate: true },
);
function toggle(id: string) {
  expanded.has(id) ? expanded.delete(id) : expanded.add(id);
}
</script>

<template>
  <nav ref="tree" class="docs-tree" aria-label="文档目录">
    <span ref="marker" class="docs-tree__active-marker" aria-hidden="true" />
    <RouterLink class="docs-tree__home" to="/blog" @click="emit('navigate')">知识库总览 <span>↗</span></RouterLink>
    <p class="docs-eyebrow">按主题阅读</p>
    <section v-for="topic in topics" :key="topic.id" class="docs-tree__topic">
      <div class="docs-tree__row">
        <button
          type="button"
          :aria-label="`${expanded.has(topic.id) ? '收起' : '展开'}${topic.title}`"
          :aria-expanded="expanded.has(topic.id)"
          @click="toggle(topic.id)"
        >
          <span :class="{ 'is-open': expanded.has(topic.id) }">›</span>
        </button>
        <RouterLink :to="{ path: '/blog', query: { topic: topic.id } }" @click="emit('navigate')"
          >{{ topic.title }} <small>{{ topic.count }}</small></RouterLink
        >
      </div>
      <DocsCollapse :open="expanded.has(topic.id)"
        ><div class="docs-tree__groups">
          <section v-for="group in topic.groups" :key="group.id">
            <div class="docs-tree__row docs-tree__row--group">
              <button
                type="button"
                :aria-expanded="expanded.has(group.id)"
                :aria-label="`${expanded.has(group.id) ? '收起' : '展开'}${group.title}`"
                @click="toggle(group.id)"
              >
                <span :class="{ 'is-open': expanded.has(group.id) }">›</span>
              </button>
              <RouterLink
                :to="{ path: '/blog', query: { topic: topic.id, series: group.id } }"
                @click="emit('navigate')"
                >{{ group.title }}</RouterLink
              >
            </div>
            <DocsCollapse :open="expanded.has(group.id)"
              ><div class="docs-tree__articles">
                <RouterLink
                  v-for="post in group.posts"
                  :key="post.canonicalSlug"
                  :to="{
                    path: `/posts/${post.canonicalSlug}`,
                    query: { ...route.query, topic: topic.id, series: group.id },
                  }"
                  :aria-current="currentSlug === post.canonicalSlug ? 'page' : undefined"
                  :class="{ 'is-active': currentSlug === post.canonicalSlug }"
                  @click="emit('navigate')"
                  >{{ post.title }}</RouterLink
                >
              </div></DocsCollapse
            >
          </section>
        </div></DocsCollapse
      >
    </section>
  </nav>
</template>
