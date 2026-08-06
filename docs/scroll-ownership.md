# Scroll Ownership

The blog mixes viewport scenes, panel-local scrolling, and normal document pages. Wheel and touch handlers must therefore have one active owner at a time.

## Route Contract

| Surface | Scroll owner |
| --- | --- |
| Home | `SlideController` may turn a downward gesture into the Home-to-Author transition |
| Blog | `[data-blog-scroll-container]` uses native panel scrolling; an upward gesture at its top may return Home |
| Author | `useAuthorSlider` owns slide gestures only while the Author panel is active |
| Friend | The visible Friend pane uses native scrolling |
| Works | Compact Case layouts use their panel container; the desktop Orbit scene is viewport-sized and does not invent a wheel action |
| Standalone pages | The document uses native vertical scrolling |

`body` must not be globally locked on the Y axis. The immersive home family constrains itself with a `100dvh` stage, while standalone routes are allowed to extend the document.

## Cached Panel Rule

Home panels remain mounted after their first visit. A cached, inactive panel must not call `preventDefault()` from a window-level wheel, touch, or keyboard listener. Components that retain global listeners need an explicit active state from `HomeView` and must return before handling input when inactive.

This rule prevents the hidden Author slider from blocking Blog, Friend, or Works after the user has visited Author once.

## Regression Checks

```bash
pnpm --filter @woodfish-nest/blog test -- tests/home/author-slider.test.ts tests/home/slide-controller.test.ts
$env:PLAYWRIGHT_PORT='3000'; pnpm --dir apps/blog exec playwright test tests/e2e/blog-scroll.spec.ts --project=desktop-chrome
```

The browser checks cover Blog navigation, Blog scroll restoration, Author-to-Friend wheel handoff, and native scrolling on a standalone page.
