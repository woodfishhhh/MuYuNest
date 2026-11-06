import type { InjectionKey } from "vue";

import type { FilmChapterId } from "@/components/home/film/film-script";

/** Local progress (0–1) of every chapter for the current frame. */
export type FilmChapterProgress = Partial<Record<FilmChapterId, number>>;

export type FilmFrameListener = (progress: FilmChapterProgress) => void;

/** Chapters that need numbers CSS cannot compute subscribe here; returns an unsubscribe. */
export type RegisterFilmFrame = (listener: FilmFrameListener) => () => void;

export const filmFrameKey: InjectionKey<RegisterFilmFrame> = Symbol("film-frame");
