<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useTheme } from "@/composables/useTheme";
import type { ContentCard } from "@/components/scene/home-card-flight/card-config";
import { formatCardHeading } from "@/components/scene/home-card-flight/card-config";
import { resolveImageSource } from "@/components/scene/home-card-flight/catalog";
import { loadCardImage, renderImageCard, renderTextCard, type CardSurface } from "@/components/scene/home-card-flight/card-surface";

const props = defineProps<{ card: ContentCard }>();
const host = ref<HTMLElement>();
const sheets = ref<HTMLElement>();
const error = ref("");
const { theme } = useTheme();
let surfaces: CardSurface[] | undefined;
let observer: IntersectionObserver | undefined;
let disposed = false;
function repaint() {
  sheets.value?.replaceChildren(...(surfaces ?? []).map(surface => {
    const canvas = surface.render(theme.value);
    canvas.setAttribute("aria-hidden", "true");
    return canvas;
  }));
}
async function paint() {
  observer?.disconnect();
  try {
    const card = props.card;
    const loaded = card.type === "text" ? renderTextCard(card)
      : renderImageCard(card, await loadCardImage(resolveImageSource(card.src)));
    if (disposed) return;
    surfaces = loaded; repaint();
  } catch { if (!disposed) error.value = "这张图片暂时无法加载。"; }
}
onMounted(() => {
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) void paint();
  }, { rootMargin: "240px" });
  if (host.value) observer.observe(host.value);
});
watch(theme, () => { if (surfaces) repaint(); });
onBeforeUnmount(() => { disposed = true; surfaces = undefined; observer?.disconnect(); });
</script>

<template>
  <figure ref="host" :data-card-type="card.type" :data-card-id="card.id">
    <div ref="sheets" class="sheets" />
    <p v-if="error" role="alert">{{ error }}</p>
    <figcaption>{{ formatCardHeading(card) }}</figcaption>
    <p class="sr-only">{{ card.type === 'text' ? card.text : [card.alt, card.description].filter(Boolean).join(' · ') }}</p>
  </figure>
</template>

<style scoped>
figure { margin: 0; min-width: 0; }
.sheets { min-height: 260px; display: grid; gap: 16px; }
.sheets :deep(canvas) { display: block; width: 100%; height: auto; box-shadow: 0 12px 40px #0000001a; }
figcaption { padding-top: 14px; font-size: 13px; color: var(--stage-hint); }
</style>
