<script setup lang="ts">
// /1 – /4 were the old author slides; anything else is a 404.
definePageMeta({
  name: "author-page-root",
  validate: (route) => typeof route.params.page === "string" && /^[1-4]$/.test(route.params.page),
  middleware: () => navigateTo({ path: "/", hash: "#about" }, { replace: true }),
});
</script>

<template>
  <div />
</template>
