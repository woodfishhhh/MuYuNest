import type { Meta, StoryObj } from "@storybook/vue3";

import VisitorCountBadge from "./VisitorCountBadge.vue";

const meta: Meta<typeof VisitorCountBadge> = {
  title: "Home/VisitorCountBadge",
  component: VisitorCountBadge,
  tags: ["autodocs"],
  argTypes: {
    total: { control: "number" },
    isLoading: { control: "boolean" },
    hasError: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof VisitorCountBadge>;

export const Loaded: Story = {
  args: { total: 1024, isLoading: false, hasError: false },
};

export const Loading: Story = {
  args: { total: null, isLoading: true, hasError: false },
};

export const Error: Story = {
  args: { total: null, isLoading: false, hasError: true },
  parameters: {
    docs: { description: { story: "出错时组件不渲染（返回 v-if=false）" } },
  },
};
