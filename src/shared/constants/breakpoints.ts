/** Shared layout breakpoints (px). Prefer `useMediaQuery` over `window.innerWidth`. */
const BREAKPOINTS = {
  md: 768,
  lg: 1024,
} as const;

/** max-width query for viewports below the `md` breakpoint */
export const MEDIA_MAX_MD = `(max-width: ${BREAKPOINTS.md - 1}px)`;

/** min-width query for viewports at/above the `lg` breakpoint */
export const MEDIA_MIN_LG = `(min-width: ${BREAKPOINTS.lg}px)`;
