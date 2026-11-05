import { defineStore } from "pinia";
import { supportsContentLayout } from "@/utils/responsive";

export type SiteMode = "home" | "blog" | "author" | "friend" | "works" | "reading";
export type SitePanelMode = Exclude<SiteMode, "reading">;
export type WorksViewMode = "orbit" | "case";
export type HomeExperience = "collect" | "roam";

interface SiteState {
  mode: SiteMode;
  isFocusing: boolean;
  activePostSlug: string | null;
  blogScrollTop: number;
  cubeStep: number;
  worksViewMode: WorksViewMode;
  homeExperience: HomeExperience;
  hasHomeExperienceChoice: boolean;
}

export const useSiteStore = defineStore("site", {
  state: (): SiteState => ({
    mode: "home",
    isFocusing: false,
    activePostSlug: null,
    blogScrollTop: 0,
    cubeStep: 0,
    worksViewMode: "orbit",
    homeExperience: "roam",
    hasHomeExperienceChoice: false,
  }),
  actions: {
    syncHomeExperience(width: number) {
      if (!this.hasHomeExperienceChoice) {
        this.homeExperience = supportsContentLayout(width) ? "collect" : "roam";
      }
    },
    setHomeExperience(experience: HomeExperience) {
      this.homeExperience = experience;
      this.hasHomeExperienceChoice = true;
    },
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
    setBlogScrollTop(scrollTop: number) {
      this.blogScrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
    },
    goAuthor() {
      this.setPanelMode("author");
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
