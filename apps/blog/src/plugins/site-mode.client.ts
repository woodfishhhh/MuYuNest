/**
 * site-mode.client.ts
 *
 * Replaces the router.afterEach hook in the old main.ts.
 * Keeps the Pinia site store in sync with the current route name on every navigation.
 */
import { resolveSiteModeFromRoute } from "@/utils/site-mode";
import { useSiteStore } from "@/stores/site";

export default defineNuxtPlugin(() => {
  const siteStore = useSiteStore();
  const router = useRouter();

  function syncSiteMode() {
    const nextMode = resolveSiteModeFromRoute(router.currentRoute.value);
    if (!nextMode) {
      siteStore.exitFocus();
      return;
    }
    siteStore.syncRouteMode(nextMode);
  }

  // Sync on first load
  syncSiteMode();

  // An aborted or duplicate navigation must preserve the current panel's state.
  router.afterEach((_to, _from, failure) => {
    if (!failure) syncSiteMode();
  });
});
