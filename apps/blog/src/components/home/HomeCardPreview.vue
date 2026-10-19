<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { ContentCard } from "@/components/scene/home-card-flight/card-config";
import { formatCardHeading } from "@/components/scene/home-card-flight/card-config";
import { resolveImageSource } from "@/components/scene/home-card-flight/catalog";
import { loadCardImage, renderImageCard, renderTextCard } from "@/components/scene/home-card-flight/card-surface";

const props = defineProps<{ card: ContentCard }>();
const host = ref<HTMLElement>();
const sheets = ref<HTMLElement>();
const error = ref("");
let observer: IntersectionObserver | undefined;
let disposed = false;
async function paint() {
  observer?.disconnect();
  try {
    const card = props.card;
    const surfaces = card.type === "text" ? renderTextCard(card)
      : renderImageCard(card, await loadCardImage(resolveImageSource(card.src)));
    if (disposed) return;
    sheets.value?.replaceChildren(...surfaces.map(surface => {
      const canvas = surface.render();
      canvas.setAttribute("aria-hidden", "true");
      return canvas;
    }));
  } catch { if (!disposed) error.value = "这张图片暂时无法加载。"; }
}
onMounted(() => {
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) void paint();
  }, { rootMargin: "240px" });
  if (host.value) observer.observe(host.value);
});
onBeforeUnmount(() => { disposed = true; observer?.disconnect(); });
</script>

<template>
  <figure ref="host">
    <div ref="sheets" class="sheets" />
    <p v-if="error" role="alert">{{ error }}</p>
    <figcaption>{{ formatCardHeading(card) }}</figcaption>
    <p class="sr-only">{{ card.type === 'text' ? card.text : card.alt }}</p>
  </figure>
</template>

<style scoped>
figure { margin: 0; min-width: 0; }
.sheets { min-height: 260px; display: grid; gap: 16px; }
.sheets :deep(canvas) { display: block; width: 100%; height: auto; box-shadow: 0 12px 40px #0000001a; }
figcaption { padding-top: 14px; font-size: 13px; color: var(--stage-hint); }
</style>
