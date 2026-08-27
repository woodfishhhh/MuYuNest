import type { SiteMode } from "@/stores/site";

const HOME_ROUTE_NAMES = new Set([
  "home",
  "blog",
  "author",
  "author-page",
  "author-page-root",
  "friend",
  "works",
]);

export type TransitionType =
  | "none"
  | "panelTransition"
  | "overlayOpen"
  | "overlayClose"
  | "pageToPost"
  | "postToPage";

export interface TransitionIntentInput {
  fromRouteName: string | null;
  toRouteName: string | null;
  fromSiteMode: SiteMode;
  toSiteMode: SiteMode;
  fromActivePostSlug?: string | null;
  toActivePostSlug?: string | null;
  isInitialNavigation?: boolean;
}

export interface TransitionIntent {
  type: TransitionType;
  directEntry: boolean;
}

export function resolveTransitionIntent(input: TransitionIntentInput): TransitionIntent {
  const {
    fromRouteName,
    toRouteName,
    fromSiteMode,
    toSiteMode,
    fromActivePostSlug = null,
    toActivePostSlug = null,
    isInitialNavigation = false,
  } = input;

  const fromHomeRoute = !!fromRouteName && HOME_ROUTE_NAMES.has(fromRouteName);
  const toHomeRoute = !!toRouteName && HOME_ROUTE_NAMES.has(toRouteName);

  if (
    fromSiteMode !== "reading" &&
    toSiteMode === "reading" &&
    !fromActivePostSlug &&
    !!toActivePostSlug
  ) {
    return { type: "overlayOpen", directEntry: false };
  }

  if (
    fromSiteMode === "reading" &&
    toSiteMode !== "reading" &&
    !!fromActivePostSlug &&
    !toActivePostSlug
  ) {
    return { type: "overlayClose", directEntry: false };
  }

  if (toRouteName === "post" && (fromHomeRoute || !fromRouteName)) {
    return { type: "pageToPost", directEntry: isInitialNavigation || !fromRouteName };
  }

  if (fromRouteName === "post" && toHomeRoute) {
    return { type: "postToPage", directEntry: false };
  }

  if (fromHomeRoute && toHomeRoute && fromSiteMode !== toSiteMode) {
    return { type: "panelTransition", directEntry: false };
  }

  return { type: "none", directEntry: false };
}
