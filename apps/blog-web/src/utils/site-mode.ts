import type { RouteLocationNormalizedLoaded, RouteLocationRaw, RouteRecordName } from "vue-router";

import type { SitePanelMode } from "@/stores/site";

const sitePanelRouteNames = ["home", "works", "blog", "friend"] as const satisfies readonly SitePanelMode[];

export function resolveSiteModeFromRoute(
  routeOrName: Pick<RouteLocationNormalizedLoaded, "name" | "path"> | RouteRecordName | null | undefined,
): SitePanelMode | null {
  const routeName = typeof routeOrName === "object" && routeOrName !== null ? routeOrName.name : routeOrName;

  if (typeof routeName === "string") {
    if (routeName === "post") return "blog";

    if (sitePanelRouteNames.includes(routeName as SitePanelMode)) {
      return routeName as SitePanelMode;
    }
  }

  return null;
}

export function getRouteLocationForSiteMode(mode: SitePanelMode): RouteLocationRaw {
  return { name: mode };
}
