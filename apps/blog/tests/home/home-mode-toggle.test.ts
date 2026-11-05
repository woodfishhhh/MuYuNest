import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HomeModeToggle from "@/components/home/HomeModeToggle.vue";

describe("Home mode toggle", () => {
  it.each([['collect', 'true', 'roam'], ['roam', 'false', 'collect']] as const)(
    "exposes %s state and emits the opposite mode", async (current, checked, next) => {
      const wrapper = mount(HomeModeToggle, { props: { modelValue: current } });
      const toggle = wrapper.get('[role="switch"]');
      expect(toggle.attributes('aria-checked')).toBe(checked);
      expect(toggle.attributes('aria-label')).toBe('拾光模式');
      await toggle.trigger('click');
      expect(wrapper.emitted('update:modelValue')).toEqual([[next]]);
      wrapper.unmount();
    },
  );
});
