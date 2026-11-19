import { fileURLToPath } from "node:url";

import vue from "@vitejs/plugin-vue";
import type { StorybookConfig } from "@storybook/vue3-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/vue3-vite",
    options: { builder: { viteConfigPath: fileURLToPath(new URL("./vite.config.ts", import.meta.url)) } },
  },
  viteFinal(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    };
    // @storybook/vue3-vite@8.x does not add @vitejs/plugin-vue automatically.
    // Prepend it so it runs before the storybook docgen plugins.
    config.plugins = [vue(), ...(config.plugins ?? [])];
    return config;
  },
};

export default config;
