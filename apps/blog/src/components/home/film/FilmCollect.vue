<template>
  <!-- The cards themselves fall in the scene; this chapter only titles them. -->
  <div class="film-collect">
    <p class="film-kicker film-cue" style="--at: 0.02"><b>06</b> · 拾光</p>
    <h2 class="film-collect__title film-cue" style="--at: 0.05">
      <span class="film-outline">拾</span><span>光</span>
    </h2>
    <p class="film-collect__line film-cue" style="--at: 0.1">抓住一张卡片，读一段时光</p>
    <p class="film-collect__tip film-kicker film-cue" style="--at: 0.14">拖拽卡片 · 滚轮调整大小</p>
  </div>
</template>

<style scoped>
.film-collect {
  position: absolute;
  bottom: clamp(3rem, 9vh, 5.5rem);
  left: var(--film-gutter);
}

.film-collect__title {
  display: flex;
  margin: 0.6rem 0 0;
  font-family: var(--film-heading-cn);
  font-size: clamp(4.6rem, 11vw, 11rem);
  font-weight: 800;
  line-height: 1;
  color: var(--stage-fg);
}

.film-collect__title .film-outline {
  -webkit-text-stroke-width: 2px;
}

.film-collect__line {
  margin: 1rem 0 0;
  font-size: clamp(1rem, 1.5vw, 1.3rem);
  letter-spacing: 0.12em;
  color: var(--stage-hint-strong);
}

.film-collect__tip {
  margin: 0.8rem 0 0;
}
</style>
