<script setup lang="ts">
import MagneticPointer from "@/components/layout/MagneticPointer.vue";
import RouteTransitionShell from "@/components/layout/RouteTransitionShell.vue";
import { useTheme } from "@/composables/useTheme";

const { initializeTheme } = useTheme();

onMounted(() => {
  initializeTheme();
});
</script>

<template>
  <RouteTransitionShell />
  <MagneticPointer />
</template>
