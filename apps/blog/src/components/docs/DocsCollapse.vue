<script setup lang="ts">
defineProps<{ open: boolean }>();
const emit = defineEmits<{ closed: [] }>();

function prepare(element: Element) {
  (element as HTMLElement).style.height = "0px";
}
function expand(element: Element) {
  const el = element as HTMLElement;
  el.style.height = `${el.scrollHeight}px`;
}
function collapse(element: Element) {
  const el = element as HTMLElement;
  el.style.height = `${el.getBoundingClientRect().height}px`;
  void el.offsetHeight;
  el.style.height = "0px";
}
function reset(element: Element) {
  (element as HTMLElement).style.height = "";
}
</script>

<template>
  <Transition
    name="docs-collapse"
    @before-enter="prepare"
    @enter="expand"
    @after-enter="reset"
    @enter-cancelled="reset"
    @leave="collapse"
    @leave-cancelled="reset"
    @after-leave="emit('closed')"
  >
    <div v-if="open"><slot /></div>
  </Transition>
</template>
