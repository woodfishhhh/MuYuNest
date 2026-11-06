import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from "vue";
import { useRoute } from "vue-router";
import { captureDocsLayout, docsArrival, enterDocs, isDocsPath, rearrangeDocs } from "@/motion/docs-motion";

export function useDocsMotion(root: Ref<HTMLElement | null>, ready: () => boolean) {
  const route = useRoute();
  let cleanup = () => {};
  let frame = 0;
  let version = 0;
  let mounted = false;
  let entered = false;
  let renderedPath = "";
  // Capture before the next route changes this shared arrival state.
  const brief = isDocsPath(docsArrival.fromPath);
  function enterWhenReady() {
    if (!mounted || !ready() || (entered && renderedPath === route.path)) return;
    cancelAnimationFrame(frame);
    let attempts = 0;
    const enter = () => {
      const el = root.value;
      if (!el || !ready()) return;
      if (!el.isConnected) {
        if (attempts++ < 120) frame = requestAnimationFrame(enter);
        return;
      }
      const internal = entered;
      entered = true;
      renderedPath = route.path;
      cleanup();
      cleanup = enterDocs(el, internal || brief || !!route.hash);
    };
    frame = requestAnimationFrame(enter);
  }
  onMounted(() => {
    mounted = true;
    enterWhenReady();
  });
  watch(() => [ready(), route.path], enterWhenReady, { flush: "post" });
  watch(
    () => route.query,
    async (next, previous) => {
      if (!entered || !root.value || !ready() || renderedPath !== route.path) return;
      const token = ++version;
      cleanup();
      const state = captureDocsLayout(root.value);
      await nextTick();
      if (token !== version || !root.value) return;
      cleanup = rearrangeDocs(root.value, state, next.topic !== previous.topic || next.series !== previous.series);
    },
    { flush: "sync" },
  );
  onBeforeUnmount(() => {
    version++;
    cancelAnimationFrame(frame);
    cleanup();
  });
  return { brief };
}
