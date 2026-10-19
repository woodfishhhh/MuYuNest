<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import StarClusterStage from "@/components/playground/StarClusterStage.vue";
import { CLUSTER_PRESETS, CLUSTER_SLIDERS, normalizeClusterSettings, HOME_STAR_SETTINGS, HOME_STAR_SEED } from "@/components/playground/star-clusters";

const settings = reactive({ ...HOME_STAR_SETTINGS });
const stage = ref<InstanceType<typeof StarClusterStage>>();
const collect = ref(true);
const paused = ref(false);
const theme = ref<"day" | "night">("night");
const geometry = ref<"cube" | "mobius">("cube");
const cards = ref(false);
const seed = ref(HOME_STAR_SEED);
const controls = ref(true);
const reference = ref(false);
const previewSettings = computed(() => reference.value ? CLUSTER_PRESETS[0].settings : settings);
const error = ref("");
const notice = ref("");
const exportText = ref("");
const storageKey = "woodfish-star-lines-playground-v2";
const presetIndex = computed(() => CLUSTER_PRESETS.findIndex(preset => Object.keys(preset.settings).every(key =>
  preset.settings[key as keyof typeof settings] === settings[key as keyof typeof settings])));
const description = computed(() => reference.value ? "正在对照原版。再次点击“对照原版”回到你的参数。" : presetIndex.value >= 0 ? CLUSTER_PRESETS[presetIndex.value].description : "跟着感觉调一调，找到你喜欢的疏密和节奏。");

function choosePreset(index: number) { reference.value = false; Object.assign(settings, CLUSTER_PRESETS[index].settings); collect.value = true; }
function replay() { collect.value = true; paused.value = false; stage.value?.replay(); }
function reshuffle() { seed.value = Math.floor(Math.random() * 1000000); }
function toggleTheme() { theme.value = theme.value === "night" ? "day" : "night"; }
function serialize() { return { version: 2, seed: seed.value, theme: theme.value, geometry: geometry.value, cards: cards.value, settings: { ...settings } }; }
async function copy() {
  const text = JSON.stringify(serialize(), null, 2);
  try { await navigator.clipboard.writeText(text); notice.value = "已复制，可以把这组参数发给我。"; }
  catch { exportText.value = text; notice.value = "可以从下方选中并复制参数。"; }
}
function reset() { reference.value = false; Object.assign(settings, HOME_STAR_SETTINGS); seed.value = HOME_STAR_SEED; collect.value = true; paused.value = false; notice.value = "已恢复初始参数"; }
onMounted(() => {
  controls.value = window.innerWidth >= 768;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (saved?.version === 2 && saved.settings && typeof saved.settings === "object") {
      Object.assign(settings, normalizeClusterSettings(saved.settings));
      if (Number.isInteger(saved.seed)) seed.value = saved.seed;
      if (["day", "night"].includes(saved.theme)) theme.value = saved.theme;
      if (["cube", "mobius"].includes(saved.geometry)) geometry.value = saved.geometry;
      cards.value = saved.cards === true;
    }
  } catch { /* A preview can start with defaults if local storage is unavailable. */ }
  watch([settings, seed, theme, geometry, cards], () => {
    try { localStorage.setItem(storageKey, JSON.stringify(serialize())); } catch { /* Preview still works without persistence. */ }
    notice.value = "";
  }, { deep: true });
});
</script>

<template>
  <main class="star-lab" :class="{ 'is-day': theme === 'day' }" :data-cluster-mode="collect ? 'collect' : 'roam'" :data-cluster-reference="reference">
    <StarClusterStage ref="stage" :settings="previewSettings" :collect="collect" :paused="paused" :theme="theme" :geometry="geometry" :cards="cards" :seed="seed" @error="error = $event" />
    <header class="lab-heading">
      <NuxtLink to="/">← 回到首页</NuxtLink>
      <p class="eyebrow"><span /> 拾光 · 星线实验室</p>
      <h1>沿着星线，自然聚散。</h1>
      <p class="intro">{{ description }}</p>
    </header>

    <div class="view-tools">
      <button type="button" :aria-pressed="reference" @click="reference = !reference; collect = true">{{ reference ? '返回调节效果' : '对照原版' }}</button>
      <button type="button" @click="toggleTheme">{{ theme === 'night' ? '切到白天' : '切到夜晚' }}</button>
      <button type="button" :aria-pressed="paused" @click="paused = !paused">{{ paused ? '继续流动' : '暂停画面' }}</button>
    </div>

    <aside class="lab-panel" :class="{ closed: !controls }" aria-label="星簇参数">
      <button class="panel-heading" type="button" :aria-expanded="controls" aria-controls="cluster-controls" @click="controls = !controls">
        <span>调节星线 <small>{{ presetIndex >= 0 ? CLUSTER_PRESETS[presetIndex].name : '自定义' }}</small></span><span>{{ controls ? '−' : '+' }}</span>
      </button>
      <div v-show="controls" id="cluster-controls" class="panel-body">
        <div class="presets" aria-label="效果预设">
          <button v-for="(preset, index) in CLUSTER_PRESETS" :key="preset.name" type="button" :aria-pressed="presetIndex === index" @click="choosePreset(index)">{{ preset.name }}</button>
        </div>
        <div class="mode-switch">
          <button type="button" :aria-pressed="!collect" @click="collect = false">漫游星空</button>
          <button type="button" :aria-pressed="collect" @click="collect = true">聚成星线</button>
        </div>
        <div class="sliders">
          <label v-for="slider in CLUSTER_SLIDERS" :key="slider.key" :for="`cluster-${slider.key}`">
            <span>{{ slider.label }}<output>{{ slider.key === 'bunches' ? settings[slider.key] + ' 簇' : Math.round(settings[slider.key] * 100) + '%' }}</output></span>
            <input :id="`cluster-${slider.key}`" v-model.number="settings[slider.key]" type="range" :min="slider.min" :max="slider.max" :step="slider.step">
          </label>
        </div>
        <div class="scene-options">
          <label for="cluster-geometry">中心几何体<select id="cluster-geometry" v-model="geometry"><option value="cube">超立方体</option><option value="mobius">莫比乌斯环</option></select></label>
          <label for="cluster-cards">一起看看诗卡<input id="cluster-cards" v-model="cards" type="checkbox"></label>
        </div>
        <div class="secondary-actions"><button type="button" @click="replay">重播聚拢</button><button type="button" @click="reshuffle">换个分布</button></div>
        <button type="button" class="copy-button" @click="copy">复制这组参数 <span>↗</span></button>
        <div class="panel-foot"><span>参数会自动记住 · 仅在这里试调</span><button type="button" @click="reset">重置</button></div>
        <p v-if="notice" class="notice" role="status">{{ notice }}</p>
        <textarea v-if="exportText" :value="exportText" aria-label="可复制的星簇参数" readonly @focus="($event.target as HTMLTextAreaElement).select()" />
      </div>
    </aside>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p class="stage-hint"><template v-if="collect"><span class="desktop-hint">移动鼠标，看看远近的星星</span><span class="mobile-hint">轻触或拖动画面，感受星群的远近</span></template><span v-else>原来的星空，慢慢漫游</span><span v-if="cards && collect"> · 诗卡可以抓住</span></p>
  </main>
</template>

<style scoped>
.star-lab { --ink: #e4e8ef; --muted: #939ba9; --line: #ffffff14; --panel: #11151eee; --button: #ffffff07; --accent: #b8d7cc; position: fixed; inset: 0; overflow: hidden; pointer-events: auto; color: var(--ink); background: #060812; font-family: inherit; }
.star-lab.is-day { --ink: #30383e; --muted: #77807e; --line: #26352f1c; --panel: #f9faf5f2; --button: #20332906; --accent: #365c50; }
button, select, input { font: inherit; }
button { cursor: pointer; transition: background .2s, color .2s; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
.lab-heading { position: absolute; left: 40px; top: 28px; pointer-events: none; }
.lab-heading a { pointer-events: auto; font-size: 12px; color: var(--muted); text-decoration: none; }
.eyebrow { display: flex; align-items: center; gap: 9px; margin-top: 48px; color: var(--muted); font-size: 12px; letter-spacing: .14em; }
.eyebrow span { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 14px var(--accent); }
h1 { margin: 14px 0 12px; font-size: clamp(22px, 2.4vw, 34px); font-weight: 400; letter-spacing: .05em; }
.intro { color: var(--muted); font-size: 13px; max-width: 310px; line-height: 1.8; }
.view-tools { position: absolute; left: 40px; bottom: 30px; display: flex; gap: 8px; }
.view-tools button, .secondary-actions button { border: 1px solid var(--line); background: var(--button); color: var(--muted); border-radius: 8px; padding: 9px 12px; font-size: 12px; }
.view-tools button[aria-pressed=true] { border-color: var(--accent); color: var(--accent); }
.view-tools button:hover, .secondary-actions button:hover { color: var(--ink); background: var(--line); }
.lab-panel { position: absolute; right: 24px; top: 24px; width: 306px; max-height: calc(100dvh - 48px); overflow: auto; scrollbar-width: thin; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); backdrop-filter: blur(24px); box-shadow: 0 12px 60px #00000012; }
.panel-heading { width: 100%; display: flex; justify-content: space-between; align-items: center; background: transparent; border: 0; color: var(--ink); text-align: left; padding: 21px 20px 17px; font-size: 14px; }
.panel-heading small { display: block; font-size: 11px; margin-top: 5px; color: var(--muted); }
.panel-body { padding: 0 20px 18px; }
.presets { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-bottom: 20px; }
.presets button { border: 1px solid var(--line); border-radius: 7px; background: transparent; color: var(--muted); font-size: 11px; padding: 9px 2px; }
.presets button[aria-pressed=true] { color: var(--accent); border-color: var(--accent); background: var(--button); }
.mode-switch { display: grid; grid-template-columns: 1fr 1fr; background: var(--button); border: 1px solid var(--line); padding: 3px; border-radius: 9px; }
.mode-switch button { color: var(--muted); background: transparent; border: 0; font-size: 12px; border-radius: 6px; padding: 8px; }
.mode-switch button[aria-pressed=true] { background: var(--line); color: var(--ink); }
.sliders { display: grid; gap: 18px; margin: 25px 0; }
.sliders label { display: grid; gap: 9px; font-size: 12px; }
.sliders label span { display: flex; justify-content: space-between; }
output { color: var(--muted); font-variant-numeric: tabular-nums; }
input[type=range] { width: 100%; height: 4px; margin: 5px 0; accent-color: var(--accent); cursor: pointer; }
.scene-options { border-top: 1px solid var(--line); padding-top: 15px; display: grid; gap: 14px; }
.scene-options label { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
.scene-options select { max-width: 130px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 6px; font-size: 12px; }
input[type=checkbox] { width: 16px; height: 16px; accent-color: var(--accent); }
.secondary-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 22px; }
.copy-button { margin-top: 10px; padding: 12px; border-radius: 8px; width: 100%; border: 1px solid var(--line); color: var(--accent); background: var(--button); display: flex; justify-content: space-between; font-size: 12px; }
.panel-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 15px; color: var(--muted); font-size: 10px; }
.panel-foot button { border: 0; padding: 0; background: none; color: var(--muted); font-size: 11px; text-decoration: underline; text-underline-offset: 3px; }
.notice { margin-top: 12px; font-size: 11px; color: var(--accent); }
textarea { width: 100%; height: 140px; margin-top: 10px; background: var(--button); color: var(--ink); font-size: 11px; }
.stage-hint { position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%); color: var(--muted); opacity: .75; font-size: 11px; pointer-events: none; white-space: nowrap; }
.mobile-hint { display: none; }
.error { position: absolute; left: 30px; bottom: 80px; color: #df9b88; font-size: 13px; }
@media (max-width: 900px) and (min-width: 768px) { .lab-panel { width: 270px; right: 14px; } .lab-heading { left: 24px; } .intro { max-width: 240px; } .stage-hint { left: 25%; bottom: 90px; } }
@media (max-width: 767px) {
  .lab-heading { left: 22px; top: 22px; } .eyebrow { margin-top: 28px; font-size: 10px; } h1 { font-size: 23px; } .intro { font-size: 11px; max-width: 260px; }
  .lab-panel { top: auto; bottom: 14px; left: 14px; right: 14px; width: auto; max-height: 65dvh; border-radius: 14px; }
  .panel-heading { padding: 15px 18px; } .panel-heading small { display: inline; margin-left: 10px; }
  .panel-body { padding: 0 18px 18px; } .view-tools { left: auto; right: 16px; top: 16px; bottom: auto; gap: 4px; } .view-tools button { padding: 7px 9px; font-size: 10px; }
  .desktop-hint { display: none; } .mobile-hint { display: inline; }
  .lab-panel:not(.closed) ~ .stage-hint { display: none; }
  .stage-hint { bottom: 83px; font-size: 10px; } .error { bottom: 110px; left: 22px; right: 22px; }
}
</style>
