import { hasMath } from '@/lib/markdown/has-math';
import { normalizeMarkdownContent } from '@/lib/markdown/normalize';

/**
 * Starts downloading the KaTeX renderer that `MarkdownRenderer` loads on demand
 * when any of `contents` has math, so a client-rendered view (the quiz player)
 * has it ready before its first math question mounts and the plain fallback
 * never swaps in (no layout shift). Does nothing for plain content (RIN-679).
 *
 * Kept apart from `MarkdownRenderer` so callers do not pull react-markdown into
 * their own chunk.
 */
export function preloadMathRenderer(contents: readonly string[]): void {
  if (contents.some((content) => hasMath(normalizeMarkdownContent(content)))) {
    void import('./MathMarkdown');
  }
}
