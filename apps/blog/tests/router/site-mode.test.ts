import { describe, expect, it } from "vite-plus/test";

import { getRouteLocationForSiteMode, resolveSiteModeFromRoute } from "@/utils/site-mode";

describe("site-mode routing helpers", () => {
  it("maps home panel route names back to site modes", () => {
    expect(resolveSiteModeFromRoute({ name: "home" } as never)).toBe("home");
    expect(resolveSiteModeFromRoute({ name: "works" } as never)).toBe("works");
    expect(resolveSiteModeFromRoute({ name: "blog" } as never)).toBe("blog");
    expect(resolveSiteModeFromRoute({ name: "post" } as never)).toBeNull();
  });

  it("builds named route locations for panel modes", () => {
    expect(getRouteLocationForSiteMode("friend")).toEqual({ name: "friend" });
    expect(getRouteLocationForSiteMode("author")).toEqual({ name: "author" });
  });
});
