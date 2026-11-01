// The home film drives the fixed scene behind it. Scroll changes far more
// often than Vue should re-render, so the scene samples this once per frame.

import type { FilmShot } from "@/components/home/film/film-script";

export interface HomeFilmSample {
  shot: FilmShot | null;
  /** Signed star warp for chapter seams; positive while scrolling down. */
  warp: number;
}

const IDLE_SAMPLE: HomeFilmSample = Object.freeze({ shot: null, warp: 0 });

let latest: HomeFilmSample = IDLE_SAMPLE;
// The splash holds the camera's fly-in until it lifts. The hold lapses on its
// own so a splash that never mounts cannot strand the camera in deep space.
const MAX_INTRO_HOLD_MS = 6000;
let introHeldAt: number | null = null;
// The splash plays once per visit, not on every return to Home.
let splashPlayed = false;

export function publishHomeFilm(sample: HomeFilmSample): void {
  latest = sample;
}

export function resetHomeFilm(): void {
  latest = IDLE_SAMPLE;
}

export function readHomeFilm(): HomeFilmSample {
  return latest;
}

export function setFilmIntroHold(held: boolean, now = performance.now()): void {
  introHeldAt = held ? now : null;
}

export function isFilmIntroHeld(now = performance.now()): boolean {
  return introHeldAt !== null && now - introHeldAt < MAX_INTRO_HOLD_MS;
}

export function hasSplashPlayed(): boolean {
  return splashPlayed;
}

export function markSplashPlayed(): void {
  splashPlayed = true;
}
