<script setup lang="ts">
import MagneticPointer from "@/components/layout/MagneticPointer.vue";
import RouteTransitionShell from "@/components/layout/RouteTransitionShell.vue";
import { useTheme } from "@/composables/useTheme";
import { getBaseUrl } from "@/utils/base-url";

const { initializeTheme } = useTheme();

useHead({
  link: [{ rel: "icon", type: "image/png", href: `${getBaseUrl()}favicon.png` }],
});

onMounted(() => {
  initializeTheme();
});
</script>

<template>
  <RouteTransitionShell />
  <MagneticPointer />
</template>
