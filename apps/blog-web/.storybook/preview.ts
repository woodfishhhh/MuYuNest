import type { Preview } from "@storybook/vue3";
import { setup } from "@storybook/vue3";
import { createRouter, createWebHashHistory } from "vue-router";
import { createPinia } from "pinia";

import "../src/assets/main.css";

// 提供全局 Pinia 和 Vue Router 存根，让组件在 Storybook 中不报错
setup((app) => {
  const pinia = createPinia();
  app.use(pinia);

  const router = createRouter({
    history: createWebHashHistory(),
    routes: [{ path: "/:catchAll(.*)", component: { template: "<div />" } }],
  });
  app.use(router);
});

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#050510" },
        { name: "light", value: "#f6f8ff" },
      ],
    },
    layout: "centered",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
  },
};

export default preview;
