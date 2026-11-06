import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useTheme } from "@/composables/useTheme";

type MatchMediaMock = (query: string) => MediaQueryList;

function installMatchMedia(matches: boolean) {
  const mock = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as MatchMediaMock;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: mock,
  });
  return mock;
}

describe("useTheme", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.documentElement.dataset.theme = "";
    document.documentElement.style.colorScheme = "";
    document.documentElement.style.removeProperty("--theme-switch-x");
    document.documentElement.style.removeProperty("--theme-switch-y");
    document.documentElement.style.removeProperty("--theme-switch-radius");
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    installMatchMedia(false);

    const { theme } = useTheme();
    theme.value = "night";
  });

  it("defaults to night with no storage", () => {
    const { initializeTheme, theme } = useTheme();

    initializeTheme();

    expect(theme.value).toBe("night");
    expect(document.documentElement.dataset.theme).toBe("night");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("hydrates day from storage", () => {
    window.localStorage.setItem("vuecubeblog-theme", "day");
    const { initializeTheme, theme } = useTheme();

    initializeTheme();

    expect(theme.value).toBe("day");
    expect(document.documentElement.dataset.theme).toBe("day");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("ignores invalid storage value", () => {
    window.localStorage.setItem("vuecubeblog-theme", "invalid-theme");
    const { initializeTheme, theme } = useTheme();

    initializeTheme();

    expect(theme.value).toBe("night");
    expect(document.documentElement.dataset.theme).toBe("night");
  });

  it("toggleThemeSync flips night to day and persists", () => {
    const { initializeTheme, toggleThemeSync, theme } = useTheme();
    initializeTheme();

    toggleThemeSync();

    expect(theme.value).toBe("day");
    expect(window.localStorage.getItem("vuecubeblog-theme")).toBe("day");
  });

  it("toggleThemeSync flips day to night and persists", () => {
    window.localStorage.setItem("vuecubeblog-theme", "day");
    const { initializeTheme, toggleThemeSync, theme } = useTheme();
    initializeTheme();

    toggleThemeSync();

    expect(theme.value).toBe("night");
    expect(window.localStorage.getItem("vuecubeblog-theme")).toBe("night");
  });

  it("toggleThemeAt falls back synchronously when startViewTransition is missing", () => {
    const { initializeTheme, toggleThemeAt, theme } = useTheme();
    initializeTheme();

    toggleThemeAt(120, 80);

    expect(theme.value).toBe("day");
    expect(window.localStorage.getItem("vuecubeblog-theme")).toBe("day");
    expect(document.documentElement.style.getPropertyValue("--theme-switch-x")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--theme-switch-y")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--theme-switch-radius")).toBe("");
  });

  it("toggleThemeAt falls back synchronously when reduced motion is enabled", () => {
    const startViewTransition = vi.fn() as unknown as Document["startViewTransition"];
    (
      document as Document & { startViewTransition?: Document["startViewTransition"] }
    ).startViewTransition = startViewTransition;
    installMatchMedia(true);

    const { initializeTheme, toggleThemeAt, theme } = useTheme();
    initializeTheme();

    toggleThemeAt(42, 24);

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(theme.value).toBe("day");
    expect(window.localStorage.getItem("vuecubeblog-theme")).toBe("day");
  });

  it("calls native view transition with document as receiver", () => {
    const startViewTransition = vi.fn(function (this: Document, callback: () => void) {
      if (this !== document) throw new TypeError("Illegal invocation");
      callback();
      return { finished: Promise.resolve() };
    }) as unknown as Document["startViewTransition"];
    (
      document as Document & { startViewTransition?: Document["startViewTransition"] }
    ).startViewTransition = startViewTransition;

    const { initializeTheme, toggleThemeAt, theme } = useTheme();
    initializeTheme();

    expect(() => toggleThemeAt(42, 24)).not.toThrow();
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(theme.value).toBe("day");
    expect(window.localStorage.getItem("vuecubeblog-theme")).toBe("day");
  });

  it("does not throw when localStorage get/set throws", () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked get");
    });
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked set");
    });

    const { initializeTheme, toggleThemeSync } = useTheme();

    expect(() => initializeTheme()).not.toThrow();
    expect(() => toggleThemeSync()).not.toThrow();
    expect(getSpy).toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalled();
  });
});
