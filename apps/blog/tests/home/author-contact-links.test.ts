import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("gsap", () => ({
  default: {
    fromTo: vi.fn(),
    killTweensOf: vi.fn(),
    to: vi.fn(),
  },
}));

vi.mock("@/composables/useTheme", () => ({
  useTheme: () => ({ theme: { value: "night" } }),
}));

import AuthorContactLinks from "@/components/home/author/AuthorContactLinks.vue";

const contacts = {
  github: "https://github.com/woodfishhhh",
  bilibili: "https://space.bilibili.com/359728114",
  qq: "https://example.com/qq",
  wechat: "https://example.com/wechat",
  email: "https://example.com/email",
  douyin: "https://example.com/douyin",
};

describe("AuthorContactLinks", () => {
  const writeText = vi.fn<(_: string) => Promise<void>>();

  beforeEach(() => {
    vi.clearAllMocks();
    writeText.mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it.each([
    ["qq", "3053932588", "QQ"],
    ["wechat", "woodfishhhh", "WeChat"],
    ["email", "woodfishhhh@163.com", "Email"],
  ])("copies the %s contact and shows success feedback", async (id, value, label) => {
    const wrapper = mount(AuthorContactLinks, { props: { contacts } });
    const button = wrapper.get(`[data-contact-id='${id}']`);

    await button.trigger("click");
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith(value);
    expect(button.attributes("data-copy-state")).toBe("success");
    expect(wrapper.text()).toContain(`已复制 ${label}：${value}`);
  });

  it("shows a manual-copy fallback when the clipboard write fails", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    const wrapper = mount(AuthorContactLinks, { props: { contacts } });

    await wrapper.get("[data-contact-id='wechat']").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("复制失败，请手动复制 WeChat：woodfishhhh");
  });
});
