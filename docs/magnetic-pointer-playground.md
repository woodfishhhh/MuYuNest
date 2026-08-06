# Magnetic Pointer Playground

## Purpose

The magnetic pointer is a site-wide desktop enhancement. It remains a small dot during normal movement and expands only over elements that explicitly opt in. The Works cards themselves are not magnetic targets; only actionable links such as `进入项目` and `GitHub` are targets.

The stable preview route is `/playground/magnetic-pointer`. It provides four treatments that share the site's black-and-white technical visual language:

| ID | Display name | Treatment |
| --- | --- | --- |
| `corners` | 四角锁定 | Transparent center with four restrained corner marks |
| `glass` | 雾面玻璃 | Translucent surface with a soft accent highlight |
| `precision` | 精密线框 | Fine dotted technical outline |
| `inverse` | 反相墨块 | High-contrast difference-blended fill |

The second study route is `/playground/magnetic-pointer-02`. It keeps the first treatment's transparent four-corner structure and compares four restrained variations:

| ID | Display name | Treatment |
| --- | --- | --- |
| `corners` | 基准四角 | Original proportions and soft accent glow |
| `corners-hairline` | 极细角标 | One-pixel monochrome corners without glow |
| `corners-axis` | 坐标刻度 | Four edge ticks with a hollow center point |
| `corners-contrast` | 信号切角 | Higher-contrast accent corners and focus point; current default |

Selecting a treatment applies it immediately and stores it under `vuecubeblog:magnetic-pointer-style` in `localStorage`, so the same choice is used on Works after leaving the playground. An unknown or unavailable stored value falls back to `corners-contrast` (`01C`).

## Integration Contract

- DOM actions opt in with `data-magnetic-pointer="stable-target-id"`.
- Transformed DOM actions are projected from their CSS transform matrix into a four-corner viewport quad, so rotated and perspective-tilted Friend cards keep an aligned magnetic outline instead of an axis-aligned rectangle.
- Three.js actions publish their projected four-corner quad through `setSceneMagneticPointerTarget`; this keeps the outline aligned while an Orbit card is tilted.
- Touch, coarse-pointer, and reduced-motion environments keep the native interaction and do not render the custom pointer.
- New visual treatments belong in `MAGNETIC_POINTER_STYLE_IDS`, the playground preset list, and the style selectors in `MagneticPointer.vue`.
- New Works cards should expose only real actions as magnetic targets. Do not attach the attribute to the entire card.
- Orbit card bodies remain draggable even though they are not magnetic targets. Clicking `进入项目` or `GitHub` activates that action; pressing elsewhere on an Orbit card grabs it and allows the existing center-launch gesture. Case card bodies are not draggable.

## Verification

Run the focused pointer tests, then the app checks:

```bash
pnpm --filter @woodfish-nest/blog test -- tests/layout/magnetic-pointer.test.ts tests/layout/magnetic-pointer-style.test.ts
pnpm typecheck
pnpm build
```

For visual acceptance, inspect both playground routes at desktop and mobile widths, switch through every preset, hover each preview action, and verify that the page has no horizontal overflow.
