<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import StarClusterStage from "@/components/playground/StarClusterStage.vue";
import {
  STAR_MODES, COMMON_CONTROLS, MODE_CONTROLS, MOTION_PRESETS, SELECTED_PLAYGROUND,
  createModeSettings, normalizePlaygroundSettings, formatControlValue,
  type StarMode, type StarControl,
} from "@/components/playground/star-clusters";

useHead({ title: "星光运动实验室 · Woodfish" });
const mode = ref<StarMode>(SELECTED_PLAYGROUND.mode);
const modes = reactive(createModeSettings());
const settings = computed(() => modes[mode.value]);
const activeMode = computed(() => STAR_MODES.find(item => item.id === mode.value)!);
const modeControls = computed(() => MODE_CONTROLS[mode.value]);
const presets = computed(() => MOTION_PRESETS[mode.value]);
const stage = ref<InstanceType<typeof StarClusterStage>>();
const collect = ref(true);
const paused = ref(false);
const theme = ref(SELECTED_PLAYGROUND.theme);
const geometry = ref(SELECTED_PLAYGROUND.geometry);
const cards = ref(SELECTED_PLAYGROUND.cards);
const seed = ref(SELECTED_PLAYGROUND.seed);
const controls = ref(true);
const reference = ref(false);
const error = ref("");
const notice = ref("");
const exportText = ref("");
const storageKey = "woodfish-star-lines-playground-v2";
const presetIndex = computed(() => presets.value.findIndex(preset => {
  const expected = normalizePlaygroundSettings({ ...activeMode.value.defaults, ...preset.settings }, mode.value);
  return Object.keys(expected).every(key => expected[key as keyof typeof expected] === settings.value[key as keyof typeof expected]);
}));

function chooseMode(next: StarMode) {
  mode.value = next; reference.value = false; collect.value = true; exportText.value = "";
}
function choosePreset(index: number) {
  reference.value = false; collect.value = true;
  Object.assign(settings.value, normalizePlaygroundSettings({ ...activeMode.value.defaults, ...presets.value[index].settings }, mode.value));
}
function setNumber(event: Event, control: StarControl) {
  const input = event.target as HTMLInputElement;
  if (input.value !== "" && Number.isFinite(input.valueAsNumber)) {
    const value = input.valueAsNumber / (control.scale ?? 1);
    Object.assign(settings.value, normalizePlaygroundSettings({ ...settings.value, [control.key]: value }, mode.value));
    reference.value = false;
  }
  input.value = formatControlValue(settings.value[control.key], control);
}
function replay() { collect.value = true; paused.value = false; stage.value?.replay(); }
function serialize() {
  return { version: 3, mode: mode.value, seed: seed.value, theme: theme.value, geometry: geometry.value, cards: cards.value, settings: { ...settings.value }, modes: { ...modes } };
}
async function copy() {
  const text = JSON.stringify(serialize(), null, 2);
  try { await navigator.clipboard.writeText(text); exportText.value = ""; notice.value = "已复制，包含模式和完整参数。"; }
  catch { exportText.value = text; notice.value = "选中下方文字即可复制参数。"; }
}
function reset() {
  Object.assign(settings.value, SELECTED_PLAYGROUND.modes[mode.value]);
  reference.value = false; collect.value = true; paused.value = false; exportText.value = "";
}
onMounted(() => {
  controls.value = window.innerWidth >= 960;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (saved?.version === 3) {
      for (const item of STAR_MODES) {
        if (saved.modes?.[item.id] && typeof saved.modes[item.id] === "object") {
          Object.assign(modes[item.id], normalizePlaygroundSettings(saved.modes[item.id], item.id));
        }
      }
      if (STAR_MODES.some(item => item.id === saved.mode)) mode.value = saved.mode;
    } else if (saved?.version === 2 && saved.settings && typeof saved.settings === "object") {
      Object.assign(modes.rays, normalizePlaygroundSettings(saved.settings, "rays"));
    }
    if (saved?.version === 2 || saved?.version === 3) {
      if (Number.isSafeInteger(saved.seed)) seed.value = saved.seed;
      if (["day", "night"].includes(saved.theme)) theme.value = saved.theme;
      if (["cube", "mobius", "none"].includes(saved.geometry)) geometry.value = saved.geometry;
      cards.value = saved.cards === true;
    }
  } catch { /* Browser storage is optional. */ }
});
watch([modes, mode, seed, theme, geometry, cards], () => {
  try { localStorage.setItem(storageKey, JSON.stringify(serialize())); } catch { /* The controls still work when storage is disabled. */ }
  notice.value = "";
}, { deep: true });
</script>

<template>
  <main class="star-lab" :class="{ 'is-day': theme === 'day' }" :data-cluster-mode="collect ? 'collect' : 'roam'" :data-star-mode="mode" :data-cluster-reference="reference">
    <header class="lab-topbar">
      <div class="lab-brand"><NuxtLink to="/" aria-label="回到首页">拾光<span aria-hidden="true">↗</span></NuxtLink><span class="brand-divider" /><span>星光实验室<small>STAR MOTION LAB</small></span></div>
      <div class="view-tools">
        <button type="button" :aria-pressed="reference" @click="reference = !reference; collect = true">{{ reference ? '返回调节' : '对照原版' }}</button>
        <button type="button" :aria-pressed="paused" @click="paused = !paused">{{ paused ? '继续' : '暂停' }}</button>
        <button type="button" @click="theme = theme === 'night' ? 'day' : 'night'">{{ theme === 'night' ? '切到白天' : '切到夜晚' }}</button>
      </div>
    </header>
    <div class="lab-workspace">
      <section class="lab-preview" aria-label="星光实时预览">
        <StarClusterStage ref="stage" :settings="settings" :mode="mode" :reference="reference" :collect="collect" :paused="paused" :theme="theme" :geometry="geometry" :cards="cards" :seed="seed" @error="error = $event" />
        <nav class="motion-modes" aria-label="运动模式">
          <button v-for="(item, index) in STAR_MODES" :key="item.id" type="button" :aria-pressed="mode === item.id" @click="chooseMode(item.id)">
            <span class="mode-number">0{{ index + 1 }}</span><span class="mode-label">{{ item.name }}<small>{{ item.english }}</small></span><span class="mode-dot" aria-hidden="true" />
          </button>
        </nav>
        <div class="preview-caption" aria-live="polite">
          <p class="caption-label">{{ reference ? 'ORIGINAL / 原版对照' : activeMode.english + ' / LIVE PREVIEW' }}</p>
          <h1>{{ reference ? '最初的十二条星线。' : activeMode.name }}</h1>
          <p>{{ reference ? '再次点击「返回调节」，继续你的实验。' : activeMode.description }}</p>
          <span class="stage-hint">{{ paused ? '画面已暂停' : '移动指针或轻触画面，感受远近' }}<template v-if="cards && collect"> · 诗卡可以拖动</template></span>
        </div>
        <span class="preview-state"><i :class="{ 'is-paused': paused }" />{{ paused ? 'PAUSED' : 'LIVE' }}</span>
        <p v-if="error" class="preview-error" role="alert">{{ error }}</p>
      </section>
      <aside class="lab-panel" :class="{ closed: !controls }" aria-label="星光参数">
        <button class="panel-heading" type="button" :aria-expanded="controls" aria-controls="cluster-controls" @click="controls = !controls">
          <span>调节参数 <small>{{ activeMode.name }}</small></span><span class="panel-toggle">{{ controls ? '−' : '+' }}</span>
        </button>
        <div v-show="controls" id="cluster-controls" class="panel-body">
          <p class="panel-intro">放开调，看看会发生什么。<span>每种模式独立记住参数，随时恢复默认。</span></p>
          <div class="presets" aria-label="效果预设">
            <button v-for="(preset, index) in presets" :key="preset.name" type="button" :aria-pressed="!reference && presetIndex === index" @click="choosePreset(index)">{{ preset.name }}</button>
          </div>
          <p v-if="reference" class="reference-notice" role="status">正在显示原版。调节任意参数即可返回预览。</p>
          <section v-for="(group, groupIndex) in [COMMON_CONTROLS, modeControls]" :key="`${mode}-${groupIndex}`" class="control-group">
            <h2><span>0{{ groupIndex + 1 }}</span>{{ groupIndex === 0 ? '运动与星点' : '形态与轨迹' }}</h2>
            <div v-for="control in group" :key="control.key" class="parameter">
              <div class="parameter-label">
                <label :for="`cluster-${control.key}`">{{ control.label }}</label>
                <div class="number-field"><input :aria-label="`${control.label}数值`" type="number" :value="formatControlValue(settings[control.key], control)" :min="control.min * (control.scale ?? 1)" :max="control.max * (control.scale ?? 1)" :step="control.step * (control.scale ?? 1)" @change="setNumber($event, control)"><span>{{ control.unit }}</span></div>
              </div>
              <input :id="`cluster-${control.key}`" v-model.number="settings[control.key]" type="range" :min="control.min" :max="control.max" :step="control.step" :aria-valuetext="formatControlValue(settings[control.key], control) + control.unit" @input="reference = false">
              <div class="parameter-scale" aria-hidden="true"><span>{{ formatControlValue(control.min, control) }}{{ control.unit }}</span><span>{{ formatControlValue(control.max, control) }}{{ control.unit }}</span></div>
            </div>
          </section>
          <section class="scene-options">
            <h2><span>03</span>场景</h2>
            <div class="field-row"><label for="cluster-geometry">中心几何体</label><select id="cluster-geometry" v-model="geometry"><option value="cube">超立方体</option><option value="mobius">莫比乌斯环</option><option value="none">只看星光</option></select></div>
            <label class="field-row" for="cluster-cards">一起看看诗卡<input id="cluster-cards" v-model="cards" type="checkbox"></label>
            <div class="mode-switch"><button type="button" :aria-pressed="collect" @click="collect = true">运动效果</button><button type="button" :aria-pressed="!collect" @click="collect = false">漫游星空</button></div>
          </section>
          <div class="secondary-actions"><button type="button" @click="replay">重新播放</button><button type="button" @click="seed = Math.floor(Math.random() * 1000000)">换个分布</button></div>
          <button type="button" class="copy-button" @click="copy">复制这组参数<span aria-hidden="true">↗</span></button>
          <div class="panel-foot"><span>自动保存于当前浏览器</span><button type="button" @click="reset">恢复默认</button></div>
          <p v-if="notice" class="notice" role="status">{{ notice }}</p>
          <label v-if="exportText" class="export-field">可复制的星光参数<textarea :value="exportText" readonly @focus="($event.target as HTMLTextAreaElement).select()" /></label>
        </div>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.star-lab { --ink: #e9edeb; --muted: #94a09e; --faint: #61716e; --line: #ffffff12; --panel: #101613; --button: #ffffff06; --accent: #b8dbbf; --field: #ffffff07; position: fixed; inset: 0; z-index: 30; display: flex; flex-direction: column; overflow: hidden; pointer-events: auto; color: var(--ink); background: #060812; font-family: inherit; }
.star-lab.is-day { --ink: #293c35; --muted: #64766d; --faint: #8a978e; --line: #28443219; --panel: #f3f4ed; --button: #243c3106; --field: #243c3107; --accent: #365d44; }
button, select, input, textarea { font: inherit; }
button { cursor: pointer; transition: color .18s, background .18s, border-color .18s; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.lab-topbar { height: 78px; flex-shrink: 0; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 1px solid var(--line); background: var(--panel); }
.lab-brand { display: flex; align-items: center; gap: 24px; font-size: 15px; letter-spacing: .05em; }
.lab-brand a { color: var(--ink); text-decoration: none; font-size: 19px; }
.lab-brand a > span { margin-left: 12px; font-size: 13px; color: var(--muted); }
.brand-divider { height: 26px; width: 1px; background: var(--line); }
.lab-brand small { display: block; color: var(--muted); font-size: 9px; letter-spacing: .16em; margin-top: 3px; }
.view-tools { display: flex; align-items: center; gap: 8px; }
.view-tools button { min-height: 38px; border: 1px solid var(--line); background: transparent; color: var(--muted); padding: 0 14px; border-radius: 6px; font-size: 12px; }
.view-tools button[aria-pressed=true] { color: var(--accent); border-color: var(--accent); }
.view-tools button:hover { color: var(--ink); background: var(--button); }
.lab-workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 400px; }
.lab-preview { position: relative; min-width: 0; overflow: hidden; }
.motion-modes { position: absolute; top: 30px; left: 32px; right: 32px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.motion-modes button { display: flex; align-items: center; gap: 12px; min-height: 70px; padding: 12px 16px; text-align: left; color: var(--muted); border: 1px solid var(--line); border-radius: 8px; background: var(--button); backdrop-filter: blur(18px); }
.motion-modes button:hover { border-color: var(--faint); color: var(--ink); }
.motion-modes button[aria-pressed=true] { border-color: var(--accent); color: var(--accent); background: var(--field); }
.mode-number { font: 12px ui-monospace, monospace; opacity: .65; }
.mode-label { font-size: 14px; white-space: nowrap; }
.mode-label small { display: block; font-size: 9px; letter-spacing: .14em; margin-top: 6px; opacity: .6; }
.mode-dot { width: 5px; height: 5px; flex-shrink: 0; margin-left: auto; border-radius: 50%; background: currentColor; opacity: 0; }
[aria-pressed=true] > .mode-dot { opacity: 1; }
.preview-caption { position: absolute; left: 38px; right: 30px; bottom: 34px; pointer-events: none; }
.caption-label { color: var(--accent); font: 10px ui-monospace, monospace; letter-spacing: .15em; }
.preview-caption h1 { font-size: clamp(24px, 2.6vw, 38px); font-weight: 400; letter-spacing: .05em; margin: 12px 0 10px; }
.preview-caption > p:not(.caption-label) { color: var(--muted); font-size: 13px; line-height: 1.7; }
.stage-hint { display: block; margin-top: 24px; color: var(--faint); font-size: 11px; }
.preview-state { position: absolute; right: 32px; bottom: 34px; display: flex; align-items: center; gap: 8px; color: var(--muted); font: 10px ui-monospace, monospace; letter-spacing: .12em; }
.preview-state i { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
.preview-state i.is-paused { background: var(--muted); }
.preview-error { position: absolute; top: 120px; left: 32px; right: 32px; color: #de9b83; font-size: 13px; }
.lab-panel { min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--faint) transparent; background: var(--panel); border-left: 1px solid var(--line); }
.panel-heading { display: flex; width: 100%; align-items: center; justify-content: space-between; padding: 28px 28px 0; border: 0; background: transparent; color: var(--ink); text-align: left; font-size: 17px; }
.panel-heading small { font-size: 12px; color: var(--muted); margin-left: 12px; }
.panel-toggle { font-size: 22px; color: var(--muted); }
.panel-body { padding: 0 28px 24px; }
.panel-intro { font-size: 14px; margin: 18px 0 24px; line-height: 1.7; }
.panel-intro span { display: block; color: var(--muted); font-size: 11px; margin-top: 4px; }
.presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin-bottom: 30px; }
.presets button { min-height: 38px; padding: 6px 2px; font-size: 12px; color: var(--muted); background: transparent; border: 1px solid var(--line); border-radius: 5px; }
.presets button[aria-pressed=true] { color: var(--accent); border-color: var(--accent); background: var(--button); }
.control-group { margin-bottom: 30px; }
h2 { display: flex; align-items: center; gap: 12px; padding-top: 20px; border-top: 1px solid var(--line); color: var(--ink); font-size: 13px; font-weight: 400; margin: 0 0 22px; }
h2 > span { color: var(--faint); font: 10px ui-monospace, monospace; }
.parameter { margin-bottom: 20px; }
.parameter-label { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.parameter-label > label { font-size: 13px; }
.number-field { display: flex; align-items: center; justify-content: flex-end; width: 92px; min-height: 32px; border: 1px solid var(--line); border-radius: 5px; background: var(--field); }
.number-field input { width: 64px; min-width: 0; height: 30px; padding: 0 4px; border: 0; border-radius: 4px; background: transparent; color: var(--ink); text-align: right; font: 12px ui-monospace, monospace; font-variant-numeric: tabular-nums; appearance: textfield; -moz-appearance: textfield; }
.number-field input::-webkit-inner-spin-button, .number-field input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.number-field > span { color: var(--muted); min-width: 22px; text-align: center; font-size: 11px; }
input[type=range] { width: 100%; height: 22px; margin: 7px 0 0; accent-color: var(--accent); cursor: ew-resize; }
.parameter-scale { display: flex; justify-content: space-between; color: var(--faint); font: 10px ui-monospace, monospace; margin-top: -2px; }
.field-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; font-size: 13px; margin: 18px 0; }
.field-row select { max-width: 160px; min-height: 36px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 5px; color: var(--ink); background: var(--panel); font-size: 12px; }
input[type=checkbox] { width: 18px; height: 18px; accent-color: var(--accent); }
.mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; background: var(--field); border-radius: 6px; }
.mode-switch button { min-height: 36px; border: 0; border-radius: 4px; color: var(--muted); background: transparent; font-size: 12px; }
.mode-switch button[aria-pressed=true] { background: var(--line); color: var(--ink); }
.secondary-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 26px; }
.secondary-actions button { min-height: 40px; border: 1px solid var(--line); border-radius: 5px; color: var(--muted); background: transparent; font-size: 12px; }
.secondary-actions button:hover, .presets button:hover { color: var(--ink); background: var(--button); }
.copy-button { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 46px; margin-top: 12px; padding: 0 16px; border: 1px solid var(--accent); border-radius: 5px; color: var(--accent); background: var(--button); font-size: 13px; }
.copy-button:hover { background: var(--line); }
.panel-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 16px; color: var(--faint); font-size: 11px; }
.panel-foot button { min-height: 32px; border: 0; padding: 4px 0 4px 8px; color: var(--muted); background: transparent; font-size: 11px; text-decoration: underline; text-underline-offset: 4px; }
.notice, .reference-notice { color: var(--accent); font-size: 12px; line-height: 1.6; margin: 14px 0; }
.export-field { display: block; color: var(--muted); font-size: 12px; margin-top: 16px; }
textarea { display: block; box-sizing: border-box; width: 100%; height: 180px; margin-top: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 5px; color: var(--ink); background: var(--field); font: 11px ui-monospace, monospace; }
@media (min-width: 1700px) { .lab-workspace { grid-template-columns: minmax(0, 1fr) 440px; } .panel-heading { padding: 32px 36px 0; } .panel-body { padding: 0 36px 28px; } }
@media (max-width: 1150px) and (min-width: 960px) { .lab-workspace { grid-template-columns: minmax(0, 1fr) 360px; } .motion-modes { left: 20px; right: 20px; gap: 8px; } .motion-modes button { padding: 10px; gap: 8px; } .mode-label { font-size: 12px; } .mode-number, .mode-dot { display: none; } }
@media (max-width: 959px) {
  .lab-topbar { height: 64px; padding: 0 20px; } .lab-brand { gap: 16px; font-size: 13px; } .lab-brand a { font-size: 16px; }
  .lab-workspace { display: block; position: relative; } .lab-preview { height: 100%; }
  .lab-panel { position: absolute; z-index: 3; bottom: 12px; left: 12px; right: 12px; max-height: 70%; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 -10px 40px #00000012; }
  .panel-heading { position: sticky; top: 0; z-index: 2; padding: 16px 22px; min-height: 60px; font-size: 15px; background: var(--panel); } .panel-body { padding: 0 22px 22px; } .panel-intro { margin-top: 0; }
  .motion-modes { top: 20px; left: 20px; right: 20px; } .preview-caption { left: 24px; bottom: 112px; } .preview-state { right: 24px; bottom: 104px; }
  .lab-workspace:has(.lab-panel:not(.closed)) .preview-caption, .lab-workspace:has(.lab-panel:not(.closed)) .preview-state { visibility: hidden; }
  .number-field { min-height: 38px; width: 100px; } .number-field input { min-height: 36px; width: 70px; font-size: 16px; } input[type=range] { min-height: 30px; }
  .presets button, .secondary-actions button, .mode-switch button, .field-row, .panel-foot button { min-height: 44px; }
}
@media (max-width: 540px) {
  .lab-topbar { padding: 0 14px; gap: 8px; } .lab-brand > span { display: none; } .lab-brand a > span { margin-left: 6px; } .view-tools { gap: 5px; } .view-tools button { padding: 0 9px; min-height: 40px; font-size: 11px; }
  .motion-modes { top: 16px; left: 14px; right: 14px; gap: 7px; } .motion-modes button { gap: 7px; min-height: 66px; padding: 10px; } .mode-label { font-size: 12px; } .mode-label small { font-size: 8px; } .mode-number { font-size: 10px; } .mode-dot { display: none; }
  .preview-caption { left: 22px; right: 22px; } .preview-caption h1 { font-size: 28px; } .preview-caption > p:not(.caption-label) { font-size: 12px; } .preview-state { display: none; } .stage-hint { margin-top: 18px; font-size: 10px; }
  .panel-heading { padding: 14px 18px; } .panel-body { padding: 0 18px 20px; } .lab-panel { max-height: 72%; }
}
@media (max-width: 350px) { .mode-number { display: none; } .view-tools button { padding: 0 7px; font-size: 10px; } }
@media (prefers-reduced-motion: reduce) { button { transition: none; } }
</style>
