<script setup lang="ts">
import { computed } from "vue";

import { FILM_CHAPTERS, type FilmChapterId } from "@/components/home/film/film-script";

const props = defineProps<{
  id: FilmChapterId;
  label: string;
}>();

const length = computed(() => FILM_CHAPTERS.find((chapter) => chapter.id === props.id)?.length ?? 1);
</script>

<template>
  <section class="film-chapter" :data-film-chapter="props.id" :aria-label="props.label" :style="{ '--len': length }">
    <div class="film-stage">
      <slot />
    </div>
  </section>
</template>
