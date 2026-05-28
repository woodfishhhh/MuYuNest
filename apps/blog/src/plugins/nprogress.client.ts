/**
 * nprogress.client.ts
 *
 * 路由切换时显示顶部进度条。
 * 仅在客户端运行（.client 后缀）。
 */
import NProgress from "nprogress";

export default defineNuxtPlugin(() => {
  const router = useRouter();

  NProgress.configure({
    showSpinner: false,
    speed: 350,
    minimum: 0.08,
    trickleSpeed: 200,
  });

  let lastRoutePath = "";

  router.beforeEach((to) => {
    // 避免同一页面重复触发（如 query/hash 变化）
    if (to.path !== lastRoutePath) {
      NProgress.start();
    }
  });

  router.afterEach((to) => {
    lastRoutePath = to.path;
    NProgress.done();
  });

  router.onError(() => {
    NProgress.done();
  });
});
