<script setup lang="ts">
import { onMounted } from "vue";
import RouteTransitionShell from "@/components/layout/RouteTransitionShell.vue";
import { useTheme } from "@/composables/useTheme";
const { initializeTheme } = useTheme();
onMounted(initializeTheme);
</script>

<template><RouteTransitionShell /></template>
