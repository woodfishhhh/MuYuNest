# Vue blog migration

Parallel Vue SPA for the Nuxt removal stage. Production continues to use
`apps/blog` until the migration acceptance gates pass.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm generate:content:ci
pnpm blog-web:dev
pnpm blog-web:typecheck
pnpm blog-web:test
pnpm blog-web:build
pnpm --filter @woodfish-nest/blog-web test:e2e --project desktop-chrome
pnpm --filter @woodfish-nest/blog-web build-storybook
```

The static content source reads the legacy generator's `public` assets and
generated articles, author and friends. Those outputs are not duplicated here.
Article aliases keep query strings and anchors; failed content requests expose
the reader's retry action, including failures on the initial article visit.

For a subpath preview, set `VITE_BASE_URL=/next/` before building and run
`pnpm --filter @woodfish-nest/blog-web verify:dist --base-path /next/`.
The nginx preview route serves `/opt/blog-stack/sites/next` through its existing
sites mount. Missing data/assets return 404; page routes fall back to the SPA.
Do not deploy a root-base artifact to that directory.

`PLAYWRIGHT_BASE_URL` selects an existing test server. Production PWA tests
require that variable; subpath checks also require `PREVIEW_BASE_PATH=/next/`.
Visitor/analytics integration tests require isolated backends and their explicit
test flags. Mobile adaptation is deferred by the user.
