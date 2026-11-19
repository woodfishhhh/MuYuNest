import type { Meta, StoryObj } from "@storybook/vue3";

import BlogFilterRail from "./BlogFilterRail.vue";
import type { BlogFacet } from "@/content/blog-hub";

const types: BlogFacet[] = [
  { value: "Tutorial", count: 12 },
  { value: "Note", count: 8 },
  { value: "Essay", count: 5 },
];

const categories: BlogFacet[] = [
  { value: "Three.js", count: 9 },
  { value: "Vue", count: 7 },
  { value: "TypeScript", count: 6 },
  { value: "CSS", count: 4 },
];

const tags: BlogFacet[] = [
  { value: "webgl", count: 5 },
  { value: "animation", count: 4 },
  { value: "performance", count: 3 },
  { value: "tailwind", count: 3 },
  { value: "pinia", count: 2 },
];

const meta: Meta<typeof BlogFilterRail> = {
  title: "Home/Blog/BlogFilterRail",
  component: BlogFilterRail,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
  argTypes: {
    selectedType: { control: "text" },
    selectedCategory: { control: "text" },
    selectedTag: { control: "text" },
    hasActiveFilters: { control: "boolean" },
    "onToggle:type": { action: "toggle:type" },
    "onToggle:category": { action: "toggle:category" },
    "onToggle:tag": { action: "toggle:tag" },
    onClear: { action: "clear" },
  },
};

export default meta;
type Story = StoryObj<typeof BlogFilterRail>;

export const Default: Story = {
  args: {
    types,
    categories,
    tags,
    totalCount: 42,
    resultCount: 42,
    hasActiveFilters: false,
    selectedType: "",
    selectedCategory: "",
    selectedTag: "",
  },
};

export const TypeSelected: Story = {
  args: {
    types,
    categories,
    tags,
    totalCount: 42,
    resultCount: 12,
    hasActiveFilters: true,
    selectedType: "Tutorial",
    selectedCategory: "",
    selectedTag: "",
  },
};

export const CategoryAndTagSelected: Story = {
  args: {
    types,
    categories,
    tags,
    totalCount: 42,
    resultCount: 3,
    hasActiveFilters: true,
    selectedType: "",
    selectedCategory: "Vue",
    selectedTag: "pinia",
  },
};
