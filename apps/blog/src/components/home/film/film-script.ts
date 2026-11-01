// The home page plays as one film around the central geometry. Scroll is the
// playhead: every camera shot and caption is a function of scroll position,
// so scrolling back up plays the same film in reverse.

export type FilmChapterId = "opening" | "roles" | "time" | "tools" | "poem" | "collect" | "end";

/**
 * Where the camera sits relative to the geometry at the origin.
 * frameX / frameY place the geometry on screen as a fraction of the half
 * viewport: +frameX pushes it right, +frameY pushes it up.
 */
export interface FilmShot {
  yaw: number;
  pitch: number;
  distance: number;
  frameX: number;
  frameY: number;
}

export interface FilmChapter {
  id: FilmChapterId;
  label: string;
  /** Scroll length of the chapter in viewport heights. */
  length: number;
  /** Shots keyed by local progress (0–1) through the chapter. */
  shots: readonly { at: number; shot: FilmShot }[];
}

export const FILM_CHAPTERS: readonly FilmChapter[] = [
  {
    id: "opening",
    label: "片头",
    length: 1.6,
    shots: [
      { at: 0, shot: { yaw: 0, pitch: 0, distance: 12.5, frameX: 0.4, frameY: 0.08 } },
      { at: 1, shot: { yaw: 0.3, pitch: 0.1, distance: 7, frameX: 0.15, frameY: 0.1 } },
    ],
  },
  {
    id: "roles",
    label: "I'M A",
    length: 3.6,
    shots: [
      { at: 0.08, shot: { yaw: -0.8, pitch: 0.12, distance: 12, frameX: -0.1, frameY: 0.3 } },
      { at: 0.92, shot: { yaw: 0.9, pitch: 0.12, distance: 12, frameX: -0.1, frameY: 0.3 } },
    ],
  },
  {
    id: "time",
    label: "时间",
    length: 1.8,
    shots: [{ at: 0.4, shot: { yaw: 2.1, pitch: -0.14, distance: 8.5, frameX: -0.48, frameY: 0 } }],
  },
  {
    id: "tools",
    label: "工具",
    length: 2.2,
    shots: [{ at: 0.35, shot: { yaw: 2.9, pitch: 0.55, distance: 12, frameX: 0, frameY: 0 } }],
  },
  {
    id: "poem",
    label: "诗",
    length: 2,
    shots: [{ at: 0.4, shot: { yaw: 3.7, pitch: 0.06, distance: 4.6, frameX: -0.5, frameY: 0 } }],
  },
  {
    id: "collect",
    label: "拾光",
    length: 1.8,
    shots: [{ at: 0.3, shot: { yaw: Math.PI * 2, pitch: 0, distance: 12, frameX: 0, frameY: 0 } }],
  },
  {
    id: "end",
    label: "片尾",
    length: 1.4,
    shots: [{ at: 0.6, shot: { yaw: Math.PI * 2 + 0.35, pitch: 0.42, distance: 24, frameX: 0, frameY: 0.34 } }],
  },
];

export interface ShotKey {
  y: number;
  shot: FilmShot;
}

export interface ChapterLayout {
  top: number;
  height: number;
}

/** Turns chapter shot timings into absolute scroll positions. */
export function buildShotKeys(layouts: readonly ChapterLayout[], viewportHeight: number): ShotKey[] {
  return FILM_CHAPTERS.flatMap((chapter, index) => {
    const layout = layouts[index];
    if (!layout) return [];
    const travel = Math.max(1, layout.height - viewportHeight);
    return chapter.shots.map(({ at, shot }) => ({ y: layout.top + at * travel, shot }));
  });
}

function smoothstep(value: number) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function mix(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

/** The shot at scroll position y, eased between neighbouring keys. */
export function interpolateShot(keys: readonly ShotKey[], y: number): FilmShot {
  const first = keys[0];
  if (!first) return { yaw: 0, pitch: 0, distance: 10, frameX: 0, frameY: 0 };
  if (y <= first.y) return first.shot;

  for (let index = 1; index < keys.length; index += 1) {
    const previous = keys[index - 1]!;
    const next = keys[index]!;
    if (y > next.y) continue;
    const amount = smoothstep((y - previous.y) / Math.max(1, next.y - previous.y));
    return {
      yaw: mix(previous.shot.yaw, next.shot.yaw, amount),
      pitch: mix(previous.shot.pitch, next.shot.pitch, amount),
      distance: mix(previous.shot.distance, next.shot.distance, amount),
      frameX: mix(previous.shot.frameX, next.shot.frameX, amount),
      frameY: mix(previous.shot.frameY, next.shot.frameY, amount),
    };
  }
  return keys[keys.length - 1]!.shot;
}

// A narrow screen has little width to spare, so the camera stands further back.
const PORTRAIT_DISTANCE_SCALE = 1.35;

/** Portrait screens stack text under the geometry instead of beside it. */
export function adaptShotToViewport(shot: FilmShot, portrait: boolean): FilmShot {
  if (!portrait) return shot;
  return {
    ...shot,
    distance: shot.distance * PORTRAIT_DISTANCE_SCALE,
    frameX: 0,
    frameY: shot.frameY + Math.abs(shot.frameX) * 0.9,
  };
}

export interface CameraPlacement {
  position: [number, number, number];
  look: [number, number, number];
}

/** Places the camera on a sphere around the origin, then trucks it so the geometry lands at the framed spot. */
export function shotToCamera(shot: FilmShot, fovDegrees: number, aspect: number): CameraPlacement {
  const { yaw, pitch, distance } = shot;
  const halfHeight = Math.tan((fovDegrees * Math.PI) / 360) * distance;
  const truckX = -shot.frameX * halfHeight * aspect;
  const truckY = -shot.frameY * halfHeight;

  const right = [Math.cos(yaw), 0, -Math.sin(yaw)] as const;
  const up = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch)] as const;
  const offset = [0, 1, 2].map((axis) => right[axis]! * truckX + up[axis]! * truckY) as [number, number, number];

  return {
    position: [
      Math.sin(yaw) * Math.cos(pitch) * distance + offset[0],
      Math.sin(pitch) * distance + offset[1],
      Math.cos(yaw) * Math.cos(pitch) * distance + offset[2],
    ],
    look: offset,
  };
}

/** 1 right at a chapter seam, fading to 0 about a third of a screen away. */
export function seamStrength(layouts: readonly ChapterLayout[], y: number, viewportHeight: number): number {
  let strongest = 0;
  for (const layout of layouts.slice(1)) {
    const distance = (y + viewportHeight * 0.5 - layout.top) / (viewportHeight * 0.35);
    strongest = Math.max(strongest, Math.exp(-distance * distance));
  }
  return strongest;
}
