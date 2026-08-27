<script setup lang="ts">
import HomeView from "~/views/HomeView.vue";

import { isValidAuthorPageParam } from "@/utils/author-route";

definePageMeta({
  name: "author-page-root",
  validate: (route) => isValidAuthorPageParam(route.params.page),
});
</script>

<template>
  <HomeView />
</template>
