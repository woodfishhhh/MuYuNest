// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  // ── Source directory ──────────────────────────────────────────────────────
  // Keep existing src/ structure to minimise file moves
  srcDir: "src",

  // ── SSR / Generation mode ────────────────────────────────────────────────
  // SPA mode: client-side only, equivalent to the current Vite SPA build.
  // This keeps Three.js and all browser-only APIs working without ClientOnly wrappers.
  ssr: false,

  // ── Framework compatibility ──────────────────────────────────────────────
  compatibilityDate: "2025-01-01",

  // ── Modules ───────────────────────────────────────────────────────────────
  // @pinia/nuxt@0.11 requires Nuxt ^3||^4 — Pinia is wired up manually via
  // src/plugins/pinia.ts + imports.presets below.
  modules: ["@vite-pwa/nuxt"],

  // ── Auto-imports ──────────────────────────────────────────────────────────
  imports: {
    presets: [
      {
        from: "pinia",
        imports: ["defineStore", "storeToRefs", "acceptHMRUpdate"],
      },
    ],
  },

  // ── Vite plugins (direct passthrough) ────────────────────────────────────
  vite: {
    define: {
      // __APP_BASE_URL__ is the true app base URL (e.g. "/" in dev, "/newBlog/" in prod).
      // import.meta.env.BASE_URL is set by Nuxt to buildAssetsDir ("/assets") which is wrong
      // for content path normalisation. We expose the real base URL via this define instead.
      __APP_BASE_URL__: JSON.stringify(process.env.NUXT_APP_BASE_URL || "/"),
    },
    resolve: {
      alias: {
        // fileURLToPath 将 file:// URL 正确转换为 Windows 路径（处理路径中的非 ASCII 字符）
        // new URL().pathname 在 Windows 上会产生 URL 编码路径（如 %E5%89%8D%E7%AB%AF），导致构建失败
        "@": fileURLToPath(new URL("src", import.meta.url)),
      },
    },
    build: {
      target: "es2020",
      cssCodeSplit: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 600,
      minify: "esbuild",
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("/node_modules/three/build/")) return "three-core";
            if (id.includes("/node_modules/three/examples/jsm/controls/")) return "three-addons";
            if (
              id.includes("/node_modules/vue/") ||
              id.includes("/node_modules/vue-router/") ||
              id.includes("/node_modules/pinia/")
            )
              return "vue-vendor";
            if (
              id.includes("/node_modules/highlight.js/") ||
              id.includes("/node_modules/markdown-it/") ||
              id.includes("/node_modules/markdown-it-anchor/") ||
              id.includes("/node_modules/github-slugger/")
            )
              return "content-vendor";
          },
        },
      },
    },
    esbuild:
      process.env.NODE_ENV === "production" ? { drop: ["console", "debugger"] } : undefined,
  },

  // ── CSS / Tailwind v4 via PostCSS ─────────────────────────────────────────
  // @tailwindcss/vite causes jiti load issues; PostCSS plugin is the safe path.
  css: ["~/assets/main.css", "~/assets/nprogress.css"],
  postcss: {
    plugins: {
      "@tailwindcss/postcss": {},
    },
  },

  // ── App head (migrated from index.html) ──────────────────────────────────
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || "/",

    // Use "assets/" dir name to match verify-dist.ts expectations (old Vite behavior)
    buildAssetsDir: "assets",

    // Disable Nuxt's built-in transitions; RouteTransitionShell handles them
    pageTransition: false,
    layoutTransition: false,

    head: {
      charset: "utf-8",
      viewport:
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
      link: [
        {
          rel: "icon",
          type: "image/svg+xml",
          href: `${process.env.NUXT_APP_BASE_URL || "/"}favicon.svg`,
        },
        {
          rel: "apple-touch-icon",
          href: `${process.env.NUXT_APP_BASE_URL || "/"}favicon.png`,
        },
      ],
      meta: [
        { name: "description", content: "木鱼的鱼窝 | Vue-powered immersive 3D blog experience." },
        { name: "theme-color", content: "#050510" },
        { property: "og:type", content: "website" },
        { property: "og:title", content: "木鱼的鱼窝 | WoodFishNest" },
        {
          property: "og:description",
          content: "木鱼的鱼窝 | Vue-powered immersive 3D blog experience.",
        },
        { property: "og:url", content: "https://woodfish.site/newBlog/" },
        { property: "og:image", content: "https://woodfish.site/newBlog/favicon.png" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "木鱼的鱼窝 | WoodFishNest" },
        {
          name: "twitter:description",
          content: "木鱼的鱼窝 | Vue-powered immersive 3D blog experience.",
        },
        { name: "twitter:image", content: "https://woodfish.site/newBlog/favicon.png" },
        {
          "http-equiv": "Content-Security-Policy",
          content:
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https:; connect-src 'self'; base-uri 'self'; form-action 'self' https://github.com;",
        },
      ],
      title: "WoodFishNest | 木鱼的鱼窝",
      // Inline critical CSS + theme detection script (replaces index.html inline)
      style: [
        {
          innerHTML: `
            :root { --stage-bg: #050510; --stage-fg: #f6f8ff; }
            :root[data-theme="day"] { --stage-bg: #fafaf7; --stage-fg: #17191f; }
            body { background-color: var(--stage-bg); color: var(--stage-fg); margin: 0; }
            #app { min-height: 100vh; }
          `,
        },
      ],
      script: [
        {
          // Theme detection before first paint (FOUC prevention)
          innerHTML: `(() => {
  const KEY = "vuecubeblog-theme";
  const DEFAULT = "night";
  let nextTheme = DEFAULT;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "night" || stored === "day") nextTheme = stored;
  } catch {}
  const root = document.documentElement;
  root.dataset.theme = nextTheme;
  root.style.colorScheme = nextTheme === "day" ? "light" : "dark";
})();`,
          tagPosition: "head",
        },
      ],
    },
  },

  // ── PWA (migrated from vite-plugin-pwa) ──────────────────────────────────
  pwa: {
    registerType: "autoUpdate",
    injectRegister: false,
    manifest: {
      name: "WOODFISH Blog",
      short_name: "WOODFISH",
      description: "WOODFISH | Vue-powered immersive 3D blog experience",
      theme_color: "#050510",
      background_color: "#050510",
      start_url: process.env.NUXT_APP_BASE_URL || "/",
      scope: process.env.NUXT_APP_BASE_URL || "/",
      display: "standalone",
      icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml" }],
    },
    workbox: {
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
      navigateFallback: "index.html",
      globPatterns: ["**/*.{js,css,svg,png,jpg,webp,ico,woff,woff2}"],
      globIgnores: [
        "content/**/*",
        "content-assets/**/*",
        "imported-assets/**/*",
        "remote-assets/**/*",
      ],
      navigateFallbackDenylist: [/^\/api\//i],
      runtimeCaching: [
        {
          // Workbox generateSW must serialize this into sw.js; regex matchers are stable here.
          urlPattern: /\/($|index\.html$|blog\/?$|works\/?$|author\/?$|friend\/?$|posts\/.*)/i,
          handler: "NetworkFirst" as const,
          options: {
            cacheName: "page-shell-cache",
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 10, maxAgeSeconds: 300 },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: "StaleWhileRevalidate" as const,
          options: {
            cacheName: "google-fonts-cache",
            expiration: { maxEntries: 10, maxAgeSeconds: 31536000 },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: "CacheFirst" as const,
          options: {
            cacheName: "gstatic-fonts-cache",
            expiration: { maxEntries: 20, maxAgeSeconds: 31536000 },
          },
        },
        {
          urlPattern: /\/(?:content-assets|imported-assets|remote-assets|content)\/.*\.(png|jpg|jpeg|webp|gif|svg)/i,
          handler: "CacheFirst" as const,
          options: {
            cacheName: "content-images-cache",
            expiration: { maxEntries: 200, maxAgeSeconds: 2592000 },
          },
        },
        {
          urlPattern: /\/post-index.*\.json/i,
          handler: "NetworkFirst" as const,
          options: {
            cacheName: "post-index-cache",
            expiration: { maxEntries: 5, maxAgeSeconds: 86400 },
          },
        },
      ],
    },
  },

  // ── Nitro (static generation output) ────────────────────────────────────
  nitro: {
    // Output to dist/ to keep compatibility with content-tools verify-dist scripts
    output: {
      publicDir: "dist",
    },
    storage: {
      // Avoid Nuxt nightly's deep cache-driver path in generated Nitro storage imports on Linux CI.
      "internal:nuxt:prerender": {
        driver: "memory",
      },
    },
    prerender: {
      // Home routes to pre-render (post routes are client-side navigated)
      routes: ["/", "/blog", "/works", "/author", "/friend"],
    },
  },

  // ── TypeScript ────────────────────────────────────────────────────────────
  typescript: {
    strict: true,
    typeCheck: false, // run manually with `nuxt typecheck`
  },

  // ── Dev tools ─────────────────────────────────────────────────────────────
  devtools: { enabled: true },
});
