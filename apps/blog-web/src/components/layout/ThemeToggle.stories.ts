import type { Meta, StoryObj } from "@storybook/vue3";

import ThemeToggle from "./ThemeToggle.vue";

const meta: Meta<typeof ThemeToggle> = {
  title: "Layout/ThemeToggle",
  component: ThemeToggle,
  tags: ["autodocs"],
  argTypes: {
    theme: {
      control: "radio",
      options: ["night", "day"],
    },
    onToggleTheme: { action: "toggleTheme" },
  },
};

export default meta;
type Story = StoryObj<typeof ThemeToggle>;

export const Night: Story = {
  args: { theme: "night" },
};

export const Day: Story = {
  args: { theme: "day" },
};
