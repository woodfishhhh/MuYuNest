import { createApp } from "vue";
import { createPinia } from "pinia";
import { createHead } from "@unhead/vue/client";
import App from "./App.vue";
import { router } from "./router";
import { useSiteStore } from "./stores/site";
import { resolveSiteModeFromRoute } from "./utils/site-mode";
import { installNprogress } from "./plugins/nprogress";
import { installAnalytics } from "./plugins/analytics";
import "./assets/main.css";
import "./assets/nprogress.css";

const app = createApp(App);
app.use(createPinia());
app.use(createHead());
const store = useSiteStore();
installNprogress(router);
router.afterEach((to, _from, failure) => {
  if (failure) return;
  const mode = resolveSiteModeFromRoute(to);
  if (mode) store.syncRouteMode(mode);
  else store.exitFocus();
});
app.use(router);
void router.isReady().then(() => {
  app.mount("#app");
  installAnalytics(router);
});
