import { hasMath } from '@/lib/markdown/has-math';
import { normalizeMarkdownContent } from '@/lib/markdown/normalize';
import type { MathMarkdown } from './MathMarkdown';

let loadedMathMarkdown: typeof MathMarkdown | null = null;

/** Records the KaTeX renderer once its chunk has loaded (see `getLoadedMathMarkdown`). */
export function noteMathMarkdownLoaded(component: typeof MathMarkdown): typeof MathMarkdown {
  loadedMathMarkdown = component;
  return component;
}

/**
 * The KaTeX renderer if its chunk has already loaded on this client, else null.
 * `MarkdownRenderer` renders it directly, because next/dynamic's own lazy
 * wrapper would still suspend for a tick and flash its fallback (RIN-732).
 */
export function getLoadedMathMarkdown(): typeof MathMarkdown | null {
  return loadedMathMarkdown;
}

// KaTeX's CSS declares its fonts with `font-display: block`, so math laid out
// before they arrive is invisible and reflows once they do (RIN-732). These two
// faces cover upright text/operators and italic variables in typical quiz math.
const KATEX_FONTS = ['1em KaTeX_Main', 'italic 1em KaTeX_Math'] as const;
// Never hold a page back longer than this for fonts; the math still renders.
const FONT_WAIT_MS = 1500;

function waitForKatexFonts(): Promise<unknown> {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts?.load) {
    return Promise.resolve();
  }
  return Promise.race([
    Promise.all(KATEX_FONTS.map((font) => fonts.load(font))),
    new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS)),
  ]);
}

/**
 * Starts downloading the KaTeX renderer that `MarkdownRenderer` loads on demand
 * when any of `contents` has math. Does nothing for plain content (RIN-679).
 *
 * The returned promise settles once the renderer, its CSS and its main fonts are
 * ready (fonts bounded by a short timeout). A client-rendered view can await it
 * before showing its first math content, so the math paints once and never swaps
 * in over raw LaTeX (no layout shift, RIN-732). It never rejects: if the chunk
 * fails here, `MarkdownRenderer` still loads it itself.
 *
 * Kept apart from `MarkdownRenderer` so callers do not pull react-markdown into
 * their own chunk.
 */
export async function preloadMathRenderer(contents: readonly string[]): Promise<void> {
  if (!contents.some((content) => hasMath(normalizeMarkdownContent(content)))) {
    return;
  }
  try {
    noteMathMarkdownLoaded((await import('./MathMarkdown')).MathMarkdown);
    await waitForKatexFonts();
  } catch {
    // Best effort only; see above.
  }
}
