<script setup lang="ts">
import HomeCardPreview from "@/components/home/HomeCardPreview.vue";
import { catalog, catalogIssues } from "@/components/scene/home-card-flight/catalog";
</script>

<template>
  <main class="card-collection">
    <header>
      <NuxtLink to="/">← 返回首页</NuxtLink>
      <p>拾光</p>
      <h1>诗句与相片</h1>
      <span>{{ catalog.length }} 则时光，慢慢读。</span>
    </header>
    <p v-for="issue in catalogIssues" :key="issue" role="alert">{{ issue }}</p>
    <div class="card-collection__grid">
      <HomeCardPreview v-for="card in catalog" :key="card.id" :card="card" />
    </div>
  </main>
</template>

<style scoped>
.card-collection { min-height: 100dvh; background: var(--stage-bg); color: var(--stage-fg); padding: 48px max(24px, calc((100vw - 1220px) / 2)); pointer-events: auto; }
header { margin-bottom: 48px; }
header a { font-size: 13px; color: var(--stage-hint); }
header p { margin-top: 56px; font-size: 11px; letter-spacing: .18em; color: var(--stage-hint); }
header h1 { margin: 12px 0; font-size: clamp(32px, 5vw, 56px); font-weight: 600; letter-spacing: -.04em; }
header > span { font-size: 14px; color: var(--stage-hint); }
.card-collection__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 40px 28px; }
@media (max-width: 800px) { .card-collection__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 16px; } }
@media (max-width: 480px) { .card-collection__grid { grid-template-columns: 1fr; } }
</style>
