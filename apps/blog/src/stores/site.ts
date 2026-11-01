import { defineStore } from "pinia";

import type { FilmChapterId } from "@/components/home/film/film-script";

export type SiteMode = "home" | "blog" | "friend" | "works" | "reading";
export type SitePanelMode = Exclude<SiteMode, "reading">;
export type WorksViewMode = "orbit" | "case";

interface SiteState {
  mode: SiteMode;
  isFocusing: boolean;
  activePostSlug: string | null;
  blogScrollTop: number;
  cubeStep: number;
  worksViewMode: WorksViewMode;
  /** The home film chapter on screen; it decides when cards fall and the geometry can be focused. */
  homeFilmChapter: FilmChapterId;
}

export const useSiteStore = defineStore("site", {
  state: (): SiteState => ({
    mode: "home",
    isFocusing: false,
    activePostSlug: null,
    blogScrollTop: 0,
    cubeStep: 0,
    worksViewMode: "orbit",
    homeFilmChapter: "opening",
  }),
  actions: {
    setPanelMode(mode: SitePanelMode) {
      this.mode = mode;
      this.isFocusing = false;
      this.activePostSlug = null;
      if (mode === "works") this.worksViewMode = "orbit";
    },
    syncRouteMode(mode: SitePanelMode) {
      this.mode = mode;
      if (mode !== "home") {
        this.isFocusing = false;
      }
      this.activePostSlug = null;
      if (mode === "works") this.worksViewMode = "orbit";
    },
    goHome() {
      this.setPanelMode("home");
    },
    goBlog() {
      this.setPanelMode("blog");
    },
    setHomeFilmChapter(chapter: FilmChapterId) {
      this.homeFilmChapter = chapter;
    },
    setBlogScrollTop(scrollTop: number) {
      this.blogScrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
    },
    goFriend() {
      this.setPanelMode("friend");
    },
    goWorks() {
      this.setPanelMode("works");
    },
    setWorksViewMode(mode: WorksViewMode) {
      this.worksViewMode = mode;
    },
    enterReading(slug: string) {
      this.mode = "reading";
      this.isFocusing = false;
      this.activePostSlug = slug;
    },
    closeReading() {
      this.mode = "blog";
      this.activePostSlug = null;
    },
    enterFocus() {
      this.isFocusing = true;
    },
    exitFocus() {
      this.isFocusing = false;
    },
    triggerStep() {
      this.cubeStep += 1;
    },
  },
});
