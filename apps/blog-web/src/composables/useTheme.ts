import { ref } from "vue";

export type ThemeMode = "night" | "day";

const THEME_STORAGE_KEY = "vuecubeblog-theme";
const DEFAULT_THEME: ThemeMode = "night";
const THEME_SET = new Set<ThemeMode>(["night", "day"]);

const theme = ref<ThemeMode>(DEFAULT_THEME);
const initialDatasetTheme =
  typeof document !== "undefined" ? (document.documentElement.dataset.theme ?? null) : null;
if (isThemeMode(initialDatasetTheme)) {
  theme.value = initialDatasetTheme;
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && THEME_SET.has(value as ThemeMode);
}

function getRoot() {
  if (typeof document === "undefined") return null;
  return document.documentElement;
}

function safeGetStoredTheme(): ThemeMode | null {
  try {
    if (typeof window === "undefined") return null;
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(value) ? value : null;
  } catch {
    return null;
  }
}

function safeSetStoredTheme(nextTheme: ThemeMode) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Ignore storage errors (private mode / disabled storage).
  }
}

function applyTheme(nextTheme: ThemeMode) {
  theme.value = nextTheme;
  const root = getRoot();
  if (!root) return;
  root.dataset.theme = nextTheme;
  root.style.colorScheme = nextTheme === "day" ? "light" : "dark";
}

function initializeTheme() {
  const initialTheme = safeGetStoredTheme() ?? DEFAULT_THEME;
  applyTheme(initialTheme);
}

function toggleThemeSync() {
  const nextTheme: ThemeMode = theme.value === "night" ? "day" : "night";
  applyTheme(nextTheme);
  safeSetStoredTheme(nextTheme);
}

function clearTransitionVars() {
  const root = getRoot();
  if (!root) return;
  root.style.removeProperty("--theme-switch-x");
  root.style.removeProperty("--theme-switch-y");
  root.style.removeProperty("--theme-switch-radius");
}

function setTransitionVars(x: number, y: number) {
  const root = getRoot();
  if (!root || typeof window === "undefined") return;

  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  root.style.setProperty("--theme-switch-x", `${x}px`);
  root.style.setProperty("--theme-switch-y", `${y}px`);
  root.style.setProperty("--theme-switch-radius", `${radius}px`);
}

function prefersReducedMotion() {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type ViewTransitionLike = {
  finished?: Promise<unknown>;
};

function getStartViewTransition():
  | ((callback: () => void) => ViewTransitionLike | undefined)
  | undefined {
  const doc =
    typeof document === "undefined"
      ? undefined
      : (document as Document & {
          startViewTransition?: (callback: () => void) => ViewTransitionLike;
        });
  if (!doc?.startViewTransition) return undefined;
  return (callback) => doc.startViewTransition?.(callback);
}

function toggleThemeAt(x: number, y: number) {
  setTransitionVars(x, y);

  const startViewTransition = getStartViewTransition();
  if (!startViewTransition || prefersReducedMotion()) {
    toggleThemeSync();
    clearTransitionVars();
    return;
  }

  const transition = startViewTransition(() => {
    toggleThemeSync();
  });

  if (!transition?.finished) {
    clearTransitionVars();
    return;
  }

  void transition.finished.finally(() => {
    clearTransitionVars();
  });
}

export const useTheme = () => ({
  theme,
  initializeTheme,
  toggleThemeSync,
  toggleThemeAt,
});
