import { createRouter, createWebHistory, type RouteLocationNormalized } from "vue-router";

import { isValidAuthorPageParam } from "@/utils/author-route";

const home = () => import("@/views/HomeView.vue");
const notFound = () => import("@/views/NotFoundView.vue");
// Author pages 1–4 render Home's author panel; any other number is a 404 at the same URL.
const authorPage = (to: RouteLocationNormalized) => isValidAuthorPageParam(to.params.page) || {
  name: "not-found", params: { pathMatch: to.path.slice(1).split("/") }, query: to.query, hash: to.hash, replace: true,
};
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "home", component: home },
    { path: "/works", name: "works", component: home },
    { path: "/friend", name: "friend", component: home },
    { path: "/blog", name: "blog", component: () => import("@/views/DocsView.vue") },
    { path: "/posts/:slug", name: "post", component: () => import("@/views/PostView.vue") },
    { path: "/author", name: "author", component: home },
    { path: "/author/:page", name: "author-page", component: home, beforeEnter: authorPage },
    { path: "/:page(\\d+)", name: "author-page-root", component: home, beforeEnter: authorPage },
    { path: "/playground/home-cards", name: "playground-home-cards", component: () => import("@/playground/home-cards.vue") },
    { path: "/playground/star-clusters", name: "playground-star-clusters", component: () => import("@/playground/star-clusters.vue") },
    { path: "/playground/magnetic-pointer", name: "magnetic-pointer-playground", component: () => import("@/playground/magnetic-pointer.vue") },
    { path: "/playground/magnetic-pointer-02", name: "magnetic-pointer-playground-02", component: () => import("@/playground/magnetic-pointer-02.vue") },
    { path: "/:pathMatch(.*)*", name: "not-found", component: notFound },
  ],
});
