import type { Meta, StoryObj } from "@storybook/vue3";

import FriendLinkCard from "./FriendLinkCard.vue";
import type { FriendLinkData } from "@/types/content";

const sampleLink: FriendLinkData = {
  name: "WoodFish",
  link: "https://blog.woodfish.site/",
  avatar: "https://avatars.githubusercontent.com/u/1?v=4",
  descr: "用代码记录生活，用文字表达思考。",
};

const linkNoAvatar: FriendLinkData = {
  name: "NoAvatar Blog",
  link: "https://example.com",
  descr: "一个没有头像的友链展示",
};

const meta: Meta<typeof FriendLinkCard> = {
  title: "Home/Friend/FriendLinkCard",
  component: FriendLinkCard,
  tags: ["autodocs"],
  parameters: {
    backgrounds: { default: "dark" },
  },
  argTypes: {
    focusable: { control: "boolean" },
    rotateDeg: { control: { type: "range", min: -15, max: 15, step: 1 } },
  },
};

export default meta;
type Story = StoryObj<typeof FriendLinkCard>;

export const Default: Story = {
  args: { link: sampleLink, focusable: true, rotateDeg: 0 },
};

export const Tilted: Story = {
  args: { link: sampleLink, focusable: true, rotateDeg: 5 },
};

export const NoAvatar: Story = {
  args: { link: linkNoAvatar, focusable: true, rotateDeg: 0 },
};

export const NotFocusable: Story = {
  args: { link: sampleLink, focusable: false, rotateDeg: 0 },
  parameters: {
    docs: {
      description: { story: "focusable=false 时卡片内链接不可 Tab 聚焦（键盘导航跳过）" },
    },
  },
};
