<script setup lang="ts">
import { reactive, watch } from "vue";
import DocsCollapse from "./DocsCollapse.vue";
import { useRoute } from "vue-router";
import { findDocsPlacement, type DocsTopic } from "@/content/docs-navigation";

const props = defineProps<{ topics: DocsTopic[]; currentSlug?: string }>();
const emit = defineEmits<{ navigate: [] }>();
const route = useRoute();
const expanded = reactive(new Set<string>());
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
  <nav class="docs-tree" aria-label="文档目录">
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
