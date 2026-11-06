import { cp, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { Plugin } from "vite";

// Keep the legacy generator as the source until the content API cutover.
export function staticArticles(): Plugin {
  const articles = fileURLToPath(new URL("../../blog/src/generated/posts/", import.meta.url));
  let output: string;
  return {
    name: "static-articles",
    configResolved(config) { output = resolve(config.root, config.build.outDir, "articles"); },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || "").split("?")[0];
        if (!path.startsWith("/articles/")) return next();
        const filename = path.slice("/articles/".length);
        if (!/^[a-zA-Z0-9_-]+\.json$/.test(filename)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        try {
          const content = await readFile(resolve(articles, filename));
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(content);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") return next(error);
          res.statusCode = 404;
          res.end();
        }
      });
    },
    async writeBundle() { await cp(articles, output, { recursive: true }); },
  };
}
