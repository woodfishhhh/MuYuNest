import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Nuxt PWA config", () => {
  it("keeps Workbox runtime cache matchers serializable", () => {
    const configSource = readFileSync(resolve(process.cwd(), "nuxt.config.ts"), "utf8");

    expect(configSource).not.toContain("urlPattern: ({");
  });
});
