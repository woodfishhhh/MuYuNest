import { describe, expect, it } from "vite-plus/test";

import { HYPERCUBE_PROJECTION_ROTATION_SPEED } from "@/composables/useHypercube";
import { MOBIUS_ROTATION_SPEED } from "@/composables/useMobiusStrip";

describe("geometry animation speed", () => {
  it("keeps hypercube projection speed aligned with the Mobius strip idle speed", () => {
    expect(HYPERCUBE_PROJECTION_ROTATION_SPEED.alpha).toBe(MOBIUS_ROTATION_SPEED.y);
    expect(HYPERCUBE_PROJECTION_ROTATION_SPEED.beta).toBe(MOBIUS_ROTATION_SPEED.x);
  });
});
