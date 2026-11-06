import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwind from "@tailwindcss/postcss";
import { VitePWA } from "vite-plugin-pwa";
import { staticArticles } from "./vite/static-articles";

const base = process.env.VITE_BASE_URL || "/";

export default defineConfig({
  base,
  plugins: [vue(), staticArticles(), VitePWA({
    registerType: "autoUpdate",
    injectRegister: "auto",
    manifest: {
      name: "WOODFISH Blog", short_name: "WOODFISH",
      description: "WOODFISH | Vue-powered immersive 3D blog experience",
      theme_color: "#050510", background_color: "#050510",
      start_url: base, scope: base, display: "standalone",
      icons: [{ src: "favicon.png", sizes: "256x256", type: "image/png" }],
    },
    workbox: {
      cleanupOutdatedCaches: true, clientsClaim: true, skipWaiting: true,
      navigateFallback: `${base}index.html`,
      globPatterns: ["index.html", "**/*.{js,css,svg,png,jpg,webp,ico,woff,woff2}"],
      globIgnores: ["content/**/*", "content-assets/**/*", "imported-assets/**/*", "remote-assets/**/*", "**/*.webp"],
      navigateFallbackDenylist: [/\/analytics(?:[/?]|$)/i, /\/api\//i, /\/articles\//i, /\/post-index\.json$/i],
      runtimeCaching: [
        { urlPattern: /\/(?:analytics(?:[/?]|$)|api\/)/i, handler: "NetworkOnly" },
        {
          urlPattern: /\/($|index\.html$|blog\/?$|works\/?$|author\/?$|friend\/?$|posts\/.*)/i,
          handler: "NetworkFirst",
          options: { cacheName: "page-shell-cache", networkTimeoutSeconds: 3, expiration: { maxEntries: 10, maxAgeSeconds: 300 } },
        },
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: "StaleWhileRevalidate",
          options: { cacheName: "google-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i, handler: "CacheFirst",
          options: { cacheName: "gstatic-fonts-cache", expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } },
        },
        {
          urlPattern: /\/assets\/.*\.webp$/i, handler: "CacheFirst",
          options: { cacheName: "home-photos-cache", expiration: { maxEntries: 64, maxAgeSeconds: 2592000 } },
        },
        {
          urlPattern: /\/(?:content-assets|imported-assets|remote-assets|content)\/.*\.(png|jpg|jpeg|webp|gif|svg)/i,
          handler: "CacheFirst",
          options: { cacheName: "content-images-cache", expiration: { maxEntries: 200, maxAgeSeconds: 2592000 } },
        },
        {
          urlPattern: /\/articles\/[^/]+\.json$/i, handler: "NetworkFirst",
          options: { cacheName: "article-content-cache", expiration: { maxEntries: 30, maxAgeSeconds: 604800 } },
        },
        {
          urlPattern: /\/post-index.*\.json/i, handler: "NetworkFirst",
          options: { cacheName: "post-index-cache", expiration: { maxEntries: 5, maxAgeSeconds: 86400 } },
        },
      ],
    },
  })],
  publicDir: "../blog/public",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  css: { postcss: { plugins: [tailwind()] } },
  server: { proxy: { "/api": "http://127.0.0.1:8080" } },
  build: {
    target: "es2020", reportCompressedSize: false, chunkSizeWarningLimit: 600,
    rollupOptions: { output: { manualChunks(id) {
      if (id.includes("/node_modules/three/build/")) return "three-core";
      if (id.includes("/node_modules/three/examples/jsm/controls/")) return "three-addons";
      if (/\/node_modules\/(?:@vue|vue|vue-router|pinia)\//.test(id)) return "vue-vendor";
      if (/\/node_modules\/(?:highlight.js|markdown-it|markdown-it-anchor|github-slugger)\//.test(id)) return "content-vendor";
    } } },
  },
});
