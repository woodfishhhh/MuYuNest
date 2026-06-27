import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { AuthorProfileData } from "@/types/content";

const author: AuthorProfileData = {
  name: "木鱼",
  title: "是一名 学生 / ACMer / 前端开发 / 电子音乐制作人",
  heroImage: "/hero.png",
  postsCount: 101,
  tagsCount: 283,
  categoriesCount: 32,
  skills: [
    { title: "Vue", color: "#42b883", img: "/vue.png", officialUrl: "https://vuejs.org/" },
    { title: "React", color: "#61dafb", img: "/react.png", officialUrl: "https://react.dev/" },
    {
      title: "Node.js",
      color: "#5fa04e",
      img: "/node.png",
      officialUrl: "https://nodejs.org/",
    },
  ],
  poem: {
    title: "卜算子·勤",
    author: "木鱼",
    lines: [
      "志坚勤为本，莫凭苦中鸣。",
      "夜以继日工作辛，汗水洒衣襟。",
      "无病叹呻吟，空自惹人评。",
      "愿得硕果累累日，笑看世间宁。",
    ],
  },
  oneself: {
    location: "中国，南昌市",
    birthDate: "2006.6.2",
    university: "江西财经大学",
    major: "计算机科学与技术",
  },
  tenyear: {
    tips: "进度",
    title: "大学阶段进度条",
    text: "保持热爱，慢慢变强。",
    start: "2024-09-01",
    end: "2028-06-30",
  },
  contacts: {
    github: "https://github.com/woodfishhhh",
    bilibili: "https://space.bilibili.com/359728114",
    qq: "https://example.com/qq",
    wechat: "https://example.com/wechat",
    email: "https://example.com/email",
    douyin: "https://example.com/douyin",
  },
};

describe("AuthorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the new 4-screen author narrative and navigation dots", async () => {
    vi.resetModules();
    vi.doMock("@/composables/useAuthorSlider", () => ({
      useAuthorSlider: () => ({
        activeIndex: { value: 0 },
        goToSlide: () => {},
      }),
    }));
    vi.doMock("@/composables/useMatterCapsules", () => ({
      useMatterCapsules: () => ({
        activateSkill: () => {},
      }),
    }));

    const AuthorPanel = (await import("@/components/home/AuthorPanel.vue")).default;
    const wrapper = mount(AuthorPanel, {
      props: {
        author,
      },
    });

    const screens = wrapper.findAll("[data-author-screen]");
    expect(screens).toHaveLength(4);
    expect(wrapper.findAll("[data-author-nav-dot]")).toHaveLength(4);
    expect(screens.map((screen) => screen.attributes("data-testid"))).toEqual([
      "author-screen-hero",
      "author-screen-about",
      "author-screen-capsules",
      "author-screen-poem",
    ]);
    expect(wrapper.text()).toContain("卜算子·勤");
    expect(wrapper.text()).toContain("大学阶段进度条");
    expect(wrapper.text()).toContain("中国，南昌市");
    expect(wrapper.text()).not.toContain("基础信息直接展开");
    expect(wrapper.text()).not.toContain("Philosophy");
    expect(wrapper.text()).not.toContain("Biography");
    expect(wrapper.text()).not.toContain("Progress");
  });
});
