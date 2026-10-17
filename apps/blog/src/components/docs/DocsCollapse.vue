<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import gsap from "gsap";
import { reducedDocsMotion } from "@/motion/docs-motion";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ closed: [] }>();
let motion: gsap.core.Timeline | null = null;
let finishPrevious: (() => void) | undefined;
function stop() {
  motion?.kill();
  finishPrevious?.();
  finishPrevious = undefined;
}
function animate(element: Element, opening: boolean, done: () => void) {
  stop();
  const el = element as HTMLElement;
  if (reducedDocsMotion()) {
    done();
    return;
  }
  const children = Array.from(
    el.querySelectorAll(".docs-tree__articles > a, .docs-tree__groups > section, .article-toc__item"),
  ).slice(0, 16);
  const finish = () => {
    gsap.set([el, ...children], { clearProps: "height,overflow,opacity,transform" });
    finishPrevious = undefined;
    done();
  };
  finishPrevious = finish;
  const target = el.scrollHeight;
  gsap.set(el, { overflow: "hidden", height: opening ? 0 : el.getBoundingClientRect().height });
  motion = gsap.timeline({ onComplete: finish }).to(el, {
    height: opening ? target : 0,
    opacity: opening ? 1 : 0,
    duration: opening ? 0.32 : 0.2,
    ease: opening ? "power3.out" : "power2.inOut",
  });
  if (opening && children.length)
    motion.fromTo(
      children,
      { x: -10, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.2, stagger: { amount: 0.12 } },
      0.03,
    );
}
onBeforeUnmount(stop);
</script>

<template>
  <Transition
    :css="false"
    @enter="(el, done) => animate(el, true, done)"
    @leave="(el, done) => animate(el, false, done)"
    @enter-cancelled="stop"
    @leave-cancelled="stop"
    @after-leave="emit('closed')"
  >
    <div v-if="open" class="docs-collapse"><slot /></div>
  </Transition>
</template>
