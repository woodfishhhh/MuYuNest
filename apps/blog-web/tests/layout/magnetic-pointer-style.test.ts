import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyMagneticPointerStyle,
  DEFAULT_MAGNETIC_POINTER_STYLE,
  initializeMagneticPointerStyle,
  MAGNETIC_POINTER_STYLE_STORAGE_KEY,
  readMagneticPointerStyle,
  resolveMagneticPointerStyle,
} from "@/utils/magnetic-pointer";

describe("magnetic pointer style selection", () => {
  afterEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.magneticPointerStyle;
  });

  it("uses the selected 01C corner treatment as the site default", () => {
    expect(resolveMagneticPointerStyle("unknown")).toBe(DEFAULT_MAGNETIC_POINTER_STYLE);
    expect(initializeMagneticPointerStyle()).toBe("corners-contrast");
    expect(document.documentElement.dataset.magneticPointerStyle).toBe("corners-contrast");
  });

  it("applies and persists a playground selection", () => {
    expect(applyMagneticPointerStyle("corners-axis")).toBe("corners-axis");
    expect(document.documentElement.dataset.magneticPointerStyle).toBe("corners-axis");
    expect(window.localStorage.getItem(MAGNETIC_POINTER_STYLE_STORAGE_KEY)).toBe(
      "corners-axis",
    );
    expect(readMagneticPointerStyle()).toBe("corners-axis");
  });

  it("keeps variant declarations on pointer descendants instead of the document root", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/layout/MagneticPointer.vue"),
      "utf8",
    );

    expect(source).toContain('<style>');
    expect(source).not.toContain('<style scoped>');
    expect(source).not.toContain(":global(:root[data-magnetic-pointer-style");
    expect(source).not.toMatch(/:root\[data-magnetic-pointer-style="[^"]+"\]\s*\{/);
    expect(source).toMatch(
      /:root\[data-magnetic-pointer-style="precision"\]\s+\.magnetic-pointer__dot\s*{/,
    );
  });
});
