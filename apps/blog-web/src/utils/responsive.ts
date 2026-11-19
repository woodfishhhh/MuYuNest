export const RESPONSIVE_BREAKPOINTS = {
  small: 640,
  content: 768,
  wide: 1024,
  canvas: 1440,
} as const;

export const CONTENT_LAYOUT_MIN_WIDTH = RESPONSIVE_BREAKPOINTS.content;
export const WIDE_LAYOUT_MIN_WIDTH = RESPONSIVE_BREAKPOINTS.wide;

export const CONTENT_LAYOUT_MEDIA_QUERY = `(min-width: ${CONTENT_LAYOUT_MIN_WIDTH}px)`;
export const WIDE_LAYOUT_MEDIA_QUERY = `(min-width: ${WIDE_LAYOUT_MIN_WIDTH}px)`;

export function supportsContentLayout(width: number) {
  return width >= CONTENT_LAYOUT_MIN_WIDTH;
}

export function supportsWideLayout(width: number) {
  return width >= WIDE_LAYOUT_MIN_WIDTH;
}
