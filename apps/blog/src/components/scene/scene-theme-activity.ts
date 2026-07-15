import type { ThemeMode } from "@/composables/useTheme";

export function getSceneThemeActivity(theme: ThemeMode) {
  return {
    hypercube: theme === "night",
    mobius: theme === "day",
  };
}
