import { createRouter, createWebHistory } from "vue-router";

const home = () => import("@/views/HomeView.vue");
const notFound = () => import("@/views/NotFoundView.vue");
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "home", component: home },
    { path: "/works", name: "works", component: home },
    { path: "/friend", name: "friend", component: home },
    { path: "/blog", name: "blog", component: () => import("@/views/DocsView.vue") },
    { path: "/posts/:slug", name: "post", component: () => import("@/views/PostView.vue") },
    { path: "/author", name: "author", redirect: { path: "/", hash: "#about" } },
    { path: "/author/:page", name: "author-page", redirect: { path: "/", hash: "#about" } },
    { path: "/:page(\\d+)", name: "author-page-root", component: notFound,
      beforeEnter: to => /^[1-4]$/.test(String(to.params.page)) ? { path: "/", hash: "#about", replace: true } : undefined },
    { path: "/playground/home-cards", name: "playground-home-cards", component: () => import("@/playground/home-cards.vue") },
    { path: "/playground/star-clusters", name: "playground-star-clusters", component: () => import("@/playground/star-clusters.vue") },
    { path: "/playground/magnetic-pointer", name: "magnetic-pointer-playground", component: () => import("@/playground/magnetic-pointer.vue") },
    { path: "/playground/magnetic-pointer-02", name: "magnetic-pointer-playground-02", component: () => import("@/playground/magnetic-pointer-02.vue") },
    { path: "/:pathMatch(.*)*", name: "not-found", component: notFound },
  ],
});
