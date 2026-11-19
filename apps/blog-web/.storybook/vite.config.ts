import tailwind from "@tailwindcss/postcss";

// Storybook owns the preview entry and Vue plugin; it does not install the site SW.
export default {
  publicDir: "../blog/public",
  css: { postcss: { plugins: [tailwind()] } },
};
