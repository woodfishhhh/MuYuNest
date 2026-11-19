import { describe, expect, it } from "vite-plus/test";

import {
  CONTENT_LAYOUT_MEDIA_QUERY,
  RESPONSIVE_BREAKPOINTS,
  supportsContentLayout,
  supportsWideLayout,
  WIDE_LAYOUT_MEDIA_QUERY,
} from "@/utils/responsive";

describe("responsive layout contract", () => {
  it("keeps semantic breakpoints aligned with Tailwind's sm, md and lg tiers", () => {
    expect(RESPONSIVE_BREAKPOINTS).toEqual({
      small: 640,
      content: 768,
      wide: 1024,
      canvas: 1440,
    });
    expect(CONTENT_LAYOUT_MEDIA_QUERY).toBe("(min-width: 768px)");
    expect(WIDE_LAYOUT_MEDIA_QUERY).toBe("(min-width: 1024px)");
  });

  it("changes content reflow and the global shell at their exact boundaries", () => {
    expect(supportsContentLayout(767)).toBe(false);
    expect(supportsContentLayout(768)).toBe(true);
    expect(supportsWideLayout(1023)).toBe(false);
    expect(supportsWideLayout(1024)).toBe(true);
  });
});
