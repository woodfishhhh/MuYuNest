import type { Meta, StoryObj } from "@storybook/vue3";

import SiteNav from "./SiteNav.vue";

const meta: Meta<typeof SiteNav> = {
  title: "Layout/SiteNav",
  component: SiteNav,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
    docs: {
      description: {
        component:
          "顶部导航栏，包含品牌 Logo、导航链接和主题切换按钮。依赖 Pinia `useSiteStore` 和 `useTheme` composable，Storybook 通过 preview.ts 全局注入了 Pinia/Router。",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SiteNav>;

export const Default: Story = {};
