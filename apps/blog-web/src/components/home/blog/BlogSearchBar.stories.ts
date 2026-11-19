import type { Meta, StoryObj } from "@storybook/vue3";

import BlogSearchBar from "./BlogSearchBar.vue";

const meta: Meta<typeof BlogSearchBar> = {
  title: "Home/Blog/BlogSearchBar",
  component: BlogSearchBar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
  argTypes: {
    query: { control: "text" },
    sort: {
      control: "select",
      options: ["latest", "oldest", "reading-time", "alphabetical"],
    },
    totalCount: { control: { type: "number", min: 0 } },
    resultCount: { control: { type: "number", min: 0 } },
    hasActiveFilters: { control: "boolean" },
    "onUpdate:query": { action: "update:query" },
    "onUpdate:sort": { action: "update:sort" },
  },
};

export default meta;
type Story = StoryObj<typeof BlogSearchBar>;

export const Default: Story = {
  args: {
    query: "",
    sort: "latest",
    totalCount: 42,
    resultCount: 42,
    hasActiveFilters: false,
  },
};

export const WithQuery: Story = {
  args: {
    query: "three.js",
    sort: "latest",
    totalCount: 42,
    resultCount: 7,
    hasActiveFilters: true,
  },
};

export const Empty: Story = {
  args: {
    query: "quantum computing",
    sort: "alphabetical",
    totalCount: 42,
    resultCount: 0,
    hasActiveFilters: true,
  },
};
