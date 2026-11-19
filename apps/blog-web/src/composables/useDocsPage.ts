import { inject, onBeforeUnmount, onMounted, ref, shallowRef, watchEffect, type InjectionKey, type Ref } from "vue";
import type { DocsTopic } from "@/content/docs-navigation";

export interface DocsPageState {
  owner: symbol | null;
  topics: DocsTopic[];
  currentSlug: string;
  ready: boolean;
  onScroll?: (container: HTMLElement) => void;
}
export const docsPageKey: InjectionKey<DocsPageState> = Symbol("docs-page");
export const docsScrollKey: InjectionKey<Ref<HTMLElement | null>> = Symbol("docs-scroll");

export function useDocsPage(options: {
  topics: () => DocsTopic[];
  ready: () => boolean;
  slug?: () => string;
  onScroll?: (container: HTMLElement) => void;
}) {
  const state = inject(docsPageKey, null);
  const mounted = ref(false);
  const owner = Symbol("page-owner");
  if (state) state.owner = owner;
  onMounted(() => {
    mounted.value = true;
  });
  watchEffect(() => {
    if (!state || state.owner !== owner) return;
    const topics = options.topics();
    if (topics.length) state.topics = topics;
    state.currentSlug = options.slug?.() ?? "";
    state.ready = mounted.value && options.ready();
    state.onScroll = options.onScroll;
  });
  onBeforeUnmount(() => {
    if (state?.owner === owner) state.ready = false;
  });
  return inject(docsScrollKey, shallowRef<HTMLElement | null>(null));
}
