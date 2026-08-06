# Responsiveness check - 2026-08-05

## Method

The audit follows the viewport matrix and transition checks from Jezweb's
[`responsiveness-check`](https://github.com/jezweb/claude-skills/tree/main/plugins/dev-tools/skills/responsiveness-check)
skill, selected after comparing responsive/frontend entries on SkillHub. The permanent project
contract is documented in `docs/responsive-layout.md`.

Routes audited: `/works`, `/author`, `/friend`, `/blog`.

Viewport widths: 320, 375, 768, 1024, 1280, 1440, 1920 and 2560 pixels. Each viewport used a
900px height in desktop Chrome. Boundary behavior was additionally tested at 767, 768, 1023 and
1024 pixels.

## Baseline issue

Page-level responsive behavior had two competing standards:

- Works changed from WebGL Orbit to compact Case at 1024px.
- SiteNav, Author and Friend changed page architecture at 768px.
- Therefore a 768-1023px tablet could show compact Works beside desktop Author, Friend and nav.
- Friend's two-column waterfall also made long names and descriptions too narrow at 320-375px.

## Changes

- Added semantic TypeScript breakpoints in `apps/blog/src/utils/responsive.ts`.
- Standardized the global shell switch at 1024px for SiteNav, Works, Author and Friend.
- Kept 768px for local content/scene reflow and 640px for small-screen density changes.
- Changed the Friend waterfall to one column below 640px and allowed names/domains to wrap.
- Added transition-boundary E2E coverage and a reusable 32-screenshot responsive audit.

## Results

| Check | Result |
| --- | --- |
| 4 routes x 8 standard widths | 32/32 passed |
| Horizontal document overflow | 0px maximum |
| Unintentionally clipped headings, paragraphs, links or buttons | 0 cases |
| Browser runtime errors during matrix | 0 |
| Compact/wide shell at 767, 768, 1023 and 1024px | 4/4 passed |
| Build and typecheck | Passed |

At 768 and 1023px, all four page-level surfaces now use the compact shell: menu navigation,
DOM Works cards, full-width Author and the Friend application drawer. At 1024px they switch
together to the wide shell.

Screenshots and machine-readable results are in `test-results/responsive-audit/`; `report.json`
contains the measurements and the directory contains one PNG per route and width. The evidence
is local test output and is intentionally not committed.

## Remaining coverage

The automated matrix uses desktop Chrome with explicit viewport sizes. It proves layout
boundaries, overflow and the current render, but does not replace a real iPad Safari input and
safe-area check. Run the same matrix in WebKit before making Safari-specific claims.
