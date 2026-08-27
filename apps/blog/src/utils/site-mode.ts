import type { RouteLocationNormalizedLoaded, RouteLocationRaw, RouteRecordName } from "vue-router";

import type { SitePanelMode } from "@/stores/site";
import { isAuthorRoutePath } from "@/utils/author-route";

const sitePanelRouteNames = [
  "home",
  "works",
  "blog",
  "author",
  "friend",
] as const satisfies readonly SitePanelMode[];

export function resolveSiteModeFromRoute(
  routeOrName:
    | Pick<RouteLocationNormalizedLoaded, "name" | "path">
    | RouteRecordName
    | null
    | undefined,
): SitePanelMode | null {
  const routeName =
    typeof routeOrName === "object" && routeOrName !== null ? routeOrName.name : routeOrName;
  const routePath =
    typeof routeOrName === "object" && routeOrName !== null ? routeOrName.path : undefined;

  if (typeof routeName === "string") {
    if (routeName === "author-page" || routeName === "author-page-root") {
      return "author";
    }

    if (sitePanelRouteNames.includes(routeName as SitePanelMode)) {
      return routeName as SitePanelMode;
    }
  }

  if (isAuthorRoutePath(routePath)) {
    return "author";
  }

  return null;
}

export function getRouteLocationForSiteMode(mode: SitePanelMode): RouteLocationRaw {
  return { name: mode };
}
