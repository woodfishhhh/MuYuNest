# Responsive layout contract

## Purpose

VueCubeBlog uses one shared breakpoint contract for page-level structure. Components may still
reflow their own content at smaller tiers, but navigation and primary panels must not disagree
about whether the site is in compact or wide mode.

## Breakpoint tiers

| Tier | Width | Tailwind | Ownership |
| --- | ---: | --- | --- |
| Small | 640px | `sm` | Local spacing, type and dense-control adjustments |
| Content | 768px | `md` | Local card grids, scene sizing and typography reflow |
| Wide | 1024px | `lg` | Global shell and page architecture |
| Canvas | 1440px | custom semantic tier | Optional large-canvas tuning only |

The TypeScript source of truth is `apps/blog/src/utils/responsive.ts`. Tailwind's default `sm`,
`md` and `lg` media queries mirror the first three values. CSS cannot consume TypeScript
constants, so any change to these values must update both the utility and the relevant CSS.

## Global shell rule

The only breakpoint that may switch a page between compact and wide architecture is 1024px.

| Surface | Compact, below 1024px | Wide, 1024px and above |
| --- | --- | --- |
| Site navigation | Theme control and menu button | Inline navigation and theme control |
| Works | DOM Case cards | WebGL Orbit/Case canvas and view toggle |
| Author | Full-width author panel | Half-width panel with visible Three.js scene |
| Friend | Full-width links and application drawer | Links plus fixed application pane |

Widths from 768px through 1023px are tablet layouts, not a mix of desktop and phone shells.
They use the compact shell with content-level tablet reflow where it improves density.

## Component rules

1. Use `supportsWideLayout()` or `WIDE_LAYOUT_MEDIA_QUERY` for JavaScript page-mode switches.
2. Use `lg:*`, `min-width: 1024px` or `max-width: 1023px` for the matching CSS shell switch.
3. Use `md:*` only for changes inside a component, never to reveal a second page architecture.
4. Keep both sides of a boundary explicit. Test 767/768 and 1023/1024, not only device names.
5. New panels must remain usable at 320px without horizontal document overflow or clipped text.
6. Interactive controls should retain a practical touch target and must not be hidden only by JS.
7. Reduced-motion behavior is independent of viewport size and remains opt-in through media query.

## Verification

The responsive E2E contract lives in
`apps/blog/tests/e2e/responsive-shell.spec.ts`. The standard visual audit widths are 320, 375,
768, 1024, 1280, 1440, 1920 and 2560 pixels at a 900px viewport height. Audit Works, Author,
Friend and Blog after any shell, navigation, fixed-position or overflow change.

Run:

```powershell
pnpm -F @woodfish-nest/blog test
pnpm -F @woodfish-nest/blog typecheck
pnpm -F @woodfish-nest/blog build
pnpm -F @woodfish-nest/blog exec playwright test tests/e2e/responsive-shell.spec.ts
```

Record visual-audit results in `docs/responsiveness-check-YYYY-MM-DD.md` and link any evidence
directory. Update this contract whenever a breakpoint or page-level layout owner changes.
