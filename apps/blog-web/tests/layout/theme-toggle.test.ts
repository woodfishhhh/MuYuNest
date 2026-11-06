import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";

import ThemeToggle from "@/components/layout/ThemeToggle.vue";

describe("ThemeToggle", () => {
  it("renders sun icon state in night mode with correct aria", () => {
    const wrapper = mount(ThemeToggle, {
      props: { theme: "night" },
    });

    const button = wrapper.get("button");
    expect(button.attributes("aria-label")).toBe("切换到白昼模式");
    expect(button.attributes("aria-pressed")).toBe("false");
    expect(wrapper.findAll("svg")).toHaveLength(1);
  });

  it("renders moon icon state in day mode with correct aria", () => {
    const wrapper = mount(ThemeToggle, {
      props: { theme: "day" },
    });

    const button = wrapper.get("button");
    expect(button.attributes("aria-label")).toBe("切换到黑夜模式");
    expect(button.attributes("aria-pressed")).toBe("true");
    expect(wrapper.findAll("svg")).toHaveLength(1);
  });

  it("emits toggleTheme with click coordinates", async () => {
    const wrapper = mount(ThemeToggle, {
      props: { theme: "night" },
    });

    await wrapper.get("button").trigger("click", { clientX: 120, clientY: 88 });

    const payload = wrapper.emitted("toggleTheme")?.[0]?.[0] as { x: number; y: number };
    expect(payload).toEqual({ x: 120, y: 88 });
  });

  it("falls back to button center when click coordinates are missing", async () => {
    const wrapper = mount(ThemeToggle, {
      props: { theme: "night" },
    });
    const button = wrapper.get("button");
    button.element.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 20,
        width: 40,
        height: 20,
      }) as DOMRect;

    await button.trigger("click", { clientX: 0, clientY: 0 });

    const payload = wrapper.emitted("toggleTheme")?.[0]?.[0] as { x: number; y: number };
    expect(payload).toEqual({ x: 30, y: 30 });
  });
});
