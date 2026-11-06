import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  isFilmIntroHeld,
  publishHomeFilm,
  readHomeFilm,
  resetHomeFilm,
  setFilmIntroHold,
} from "@/components/scene/home-film-signal";

describe("home film signal", () => {
  afterEach(() => {
    resetHomeFilm();
    setFilmIntroHold(false);
  });

  it("hands the latest shot and warp to the scene and resets when Home goes away", () => {
    const shot = { yaw: 1, pitch: 0, distance: 8, frameX: 0, frameY: 0 };
    publishHomeFilm({ shot, warp: 0.3 });
    expect(readHomeFilm()).toEqual({ shot, warp: 0.3 });

    resetHomeFilm();
    expect(readHomeFilm()).toEqual({ shot: null, warp: 0 });
  });

  it("holds the camera fly-in for the splash, but never forever", () => {
    setFilmIntroHold(true, 1000);
    expect(isFilmIntroHeld(2000)).toBe(true);
    expect(isFilmIntroHeld(1000 + 6001)).toBe(false);

    setFilmIntroHold(false);
    expect(isFilmIntroHeld(1500)).toBe(false);
  });
});
