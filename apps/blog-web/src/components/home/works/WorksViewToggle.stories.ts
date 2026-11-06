import type { Meta, StoryObj } from "@storybook/vue3";

import WorksViewToggle from "./WorksViewToggle.vue";

const meta: Meta<typeof WorksViewToggle> = {
  title: "Home/Works/WorksViewToggle",
  component: WorksViewToggle,
  tags: ["autodocs"],
  argTypes: {
    modelValue: {
      control: "radio",
      options: ["orbit", "case"],
    },
    "onUpdate:modelValue": { action: "update:modelValue" },
  },
};

export default meta;
type Story = StoryObj<typeof WorksViewToggle>;

export const Orbit: Story = {
  args: { modelValue: "orbit" },
};

export const Case: Story = {
  args: { modelValue: "case" },
};
