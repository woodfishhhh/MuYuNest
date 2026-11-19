// Navigation as travel: the star field surges along the camera axis while the
// page changes. Deeper destinations fly forward, returns back out.
export interface SceneWarpPulse {
  direction: 1 | -1;
  strength: number;
  duration: number;
}

// Same order as the site navigation; articles lie beyond every panel.
const PANEL_ORDER: readonly string[] = ["home", "works", "blog", "author", "friend"];
const ARTICLE_ROUTE = "post";
const PANEL_STRENGTH = 0.32;
const PANEL_STRENGTH_PER_STEP = 0.06;
const ATTACK_SHARE = 0.24;

function toPlace(routeName: string | null) {
  // Author pages paginate inside one panel.
  return routeName === "author-page" || routeName === "author-page-root" ? "author" : routeName;
}

/** Route names come from vue-router; anything outside the scene returns null. */
export function resolveSceneWarpPulse(
  fromRouteName: string | null,
  toRouteName: string | null,
): SceneWarpPulse | null {
  const from = toPlace(fromRouteName);
  const to = toPlace(toRouteName);
  if (!from || !to || from === to) return null;
  if (to === ARTICLE_ROUTE) return { direction: 1, strength: 0.62, duration: 1.15 };
  if (from === ARTICLE_ROUTE) return { direction: -1, strength: 0.42, duration: 1 };

  const fromIndex = PANEL_ORDER.indexOf(from);
  const toIndex = PANEL_ORDER.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) return null;

  const distance = Math.abs(toIndex - fromIndex);
  return {
    direction: toIndex > fromIndex ? 1 : -1,
    strength: PANEL_STRENGTH + PANEL_STRENGTH_PER_STEP * (distance - 1),
    duration: 0.9,
  };
}

/** Signed warp intensity `age` seconds into the pulse. */
export function sampleSceneWarpPulse(pulse: SceneWarpPulse, age: number): number {
  if (!(age > 0) || age >= pulse.duration) return 0;

  const attack = pulse.duration * ATTACK_SHARE;
  let envelope: number;
  if (age < attack) {
    envelope = 1 - (1 - age / attack) ** 3;
  } else {
    const t = (age - attack) / (pulse.duration - attack);
    envelope = 1 - t * t * (3 - 2 * t);
  }
  return pulse.direction * pulse.strength * envelope;
}
