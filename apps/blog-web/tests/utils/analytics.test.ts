import { afterEach, describe, expect, it, vi } from "vitest";

import { trackAnalyticsEvent } from "@/utils/analytics";

describe("trackAnalyticsEvent", () => {
  afterEach(() => {
    delete window.woodfishAnalytics;
    vi.restoreAllMocks();
  });

  it("forwards privacy-safe event data when the tracker is ready", () => {
    const track = vi.fn();
    window.woodfishAnalytics = { track };

    expect(trackAnalyticsEvent("works-outbound", { action: "live", project: "blog" })).toBe(
      true,
    );
    expect(track).toHaveBeenCalledWith("works-outbound", {
      action: "live",
      project: "blog",
    });
  });

  it("stays inert when analytics is blocked or unavailable", () => {
    expect(trackAnalyticsEvent("theme-change", { theme: "night" })).toBe(false);

    window.woodfishAnalytics = { track: vi.fn(() => { throw new Error("blocked"); }) };
    expect(trackAnalyticsEvent("theme-change", { theme: "night" })).toBe(false);
  });
});
