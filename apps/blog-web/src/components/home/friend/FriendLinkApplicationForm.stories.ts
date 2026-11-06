import type { Meta, StoryObj } from "@storybook/vue3";

import FriendLinkApplicationForm from "./FriendLinkApplicationForm.vue";

const meta: Meta<typeof FriendLinkApplicationForm> = {
  title: "Home/Friend/FriendLinkApplicationForm",
  component: FriendLinkApplicationForm,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
    docs: {
      description: {
        component:
          "友链申请表单。填写站点信息后会生成 GitHub Issue URL，用户在新标签中提交友链申请。包含 URL 格式验证与安全性校验（防止本地地址与非 http/https 协议）。",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FriendLinkApplicationForm>;

export const Default: Story = {};
