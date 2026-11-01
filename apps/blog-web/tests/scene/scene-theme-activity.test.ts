import { describe, expect, it } from "vite-plus/test";

import { getSceneThemeActivity } from "@/components/scene/scene-theme-activity";

describe("scene theme activity", () => {
  it("renders only the hypercube at night", () => {
    expect(getSceneThemeActivity("night")).toEqual({
      hypercube: true,
      mobius: false,
    });
  });

  it("renders only the Mobius strip during the day", () => {
    expect(getSceneThemeActivity("day")).toEqual({
      hypercube: false,
      mobius: true,
    });
  });
});
