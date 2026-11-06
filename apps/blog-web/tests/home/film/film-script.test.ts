import { describe, expect, it } from "vite-plus/test";

import {
  adaptShotToViewport,
  buildShotKeys,
  FILM_CHAPTERS,
  interpolateShot,
  seamStrength,
  shotToCamera,
  type FilmShot,
} from "@/components/home/film/film-script";

const VIEWPORT = 1000;
const layouts = FILM_CHAPTERS.reduce<{ top: number; height: number }[]>((all, chapter) => {
  const previous = all.at(-1);
  return [...all, { top: previous ? previous.top + previous.height : 0, height: chapter.length * VIEWPORT }];
}, []);
const keys = buildShotKeys(layouts, VIEWPORT);

describe("home film script", () => {
  it("runs the chapters in the agreed order, with the falling cards second to last", () => {
    expect(FILM_CHAPTERS.map((chapter) => chapter.id)).toEqual([
      "opening",
      "roles",
      "time",
      "tools",
      "poem",
      "collect",
      "end",
    ]);
  });

  it("places every shot inside its own chapter's scroll travel", () => {
    expect(keys).toHaveLength(FILM_CHAPTERS.reduce((count, chapter) => count + chapter.shots.length, 0));
    expect(keys.map((key) => key.y)).toEqual([...keys.map((key) => key.y)].sort((a, b) => a - b));
    expect(keys[0]!.y).toBe(0);
  });

  it("is a pure function of scroll position, so scrolling back replays the same shot", () => {
    const y = layouts[2]!.top + 137;
    const forward = interpolateShot(keys, y);
    interpolateShot(keys, y + 4000);
    expect(interpolateShot(keys, y)).toEqual(forward);
  });

  it("holds the first and last shots beyond the ends of the film", () => {
    expect(interpolateShot(keys, -500)).toEqual(FILM_CHAPTERS[0]!.shots[0]!.shot);
    expect(interpolateShot(keys, 1e9)).toEqual(FILM_CHAPTERS.at(-1)!.shots.at(-1)!.shot);
  });

  it("eases between neighbouring shots", () => {
    const [from, to] = [keys[2]!, keys[3]!];
    const middle = interpolateShot(keys, (from.y + to.y) / 2);
    expect(middle.yaw).toBeCloseTo((from.shot.yaw + to.shot.yaw) / 2);
    const early = interpolateShot(keys, from.y + (to.y - from.y) * 0.1);
    expect(Math.abs(early.yaw - from.shot.yaw)).toBeLessThan(Math.abs(to.shot.yaw - from.shot.yaw) * 0.1);
  });

  it("stacks the geometry above the text on portrait screens", () => {
    const shot: FilmShot = { yaw: 0, pitch: 0, distance: 10, frameX: -0.5, frameY: 0.1 };
    const portrait = adaptShotToViewport(shot, true);
    expect(portrait.frameX).toBe(0);
    expect(portrait.frameY).toBeGreaterThan(shot.frameY);
    expect(portrait.distance).toBeGreaterThan(shot.distance);
    expect(adaptShotToViewport(shot, false)).toBe(shot);
  });

  it("frames the geometry to the right by trucking the camera left", () => {
    const centered = shotToCamera({ yaw: 0, pitch: 0, distance: 10, frameX: 0, frameY: 0 }, 75, 1.6);
    expect(centered.position[0]).toBeCloseTo(0);
    expect(centered.position[2]).toBeCloseTo(10);
    for (const axis of centered.look) expect(axis).toBeCloseTo(0);

    const right = shotToCamera({ yaw: 0, pitch: 0, distance: 10, frameX: 0.5, frameY: 0 }, 75, 1.6);
    expect(right.position[0]).toBeLessThan(0);
    expect(right.look[0]).toBeCloseTo(right.position[0]);
  });

  it("only warps the stars near a chapter seam", () => {
    const seam = layouts[1]!.top - VIEWPORT / 2;
    expect(seamStrength(layouts, seam, VIEWPORT)).toBeCloseTo(1);
    expect(seamStrength(layouts, layouts[1]!.top + VIEWPORT, VIEWPORT)).toBeLessThan(0.05);
  });
});
