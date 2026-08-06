import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";

import VisitorCountBadge from "@/components/home/VisitorCountBadge.vue";

describe("VisitorCountBadge", () => {
  it("renders the total when available", () => {
    const wrapper = mount(VisitorCountBadge, {
      props: {
        total: 128,
        isLoading: false,
        hasError: false,
      },
    });

    expect(wrapper.get("[data-testid='visitor-count-badge']").text()).toContain("Visitors");
    expect(wrapper.get("[data-testid='visitor-count-badge']").text()).toContain("128");
    expect(wrapper.get("[data-testid='visitor-count-badge']").attributes("href")).toBe(
      "/analytics/",
    );
  });

  it("shows a quiet loading state before the total arrives", () => {
    const wrapper = mount(VisitorCountBadge, {
      props: {
        total: null,
        isLoading: true,
        hasError: false,
      },
    });

    expect(wrapper.get("[data-testid='visitor-count-badge']").text()).toContain("Visitors");
    expect(wrapper.get("[data-testid='visitor-count-badge']").text()).toContain("...");
  });

  it("stays hidden when the request fails", () => {
    const wrapper = mount(VisitorCountBadge, {
      props: {
        total: null,
        isLoading: false,
        hasError: true,
      },
    });

    expect(wrapper.find("[data-testid='visitor-count-badge']").exists()).toBe(false);
  });
});
