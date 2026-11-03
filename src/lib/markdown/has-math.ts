// LaTeX bracket delimiters (\( \) \[ \]) and environments (\begin{...}).
const LATEX_DELIMITER = /\\(?:\(|\[|begin\{)/;

/**
 * True when `content` may contain math that remark-math + KaTeX would render.
 *
 * Used to load the KaTeX pipeline only for content that needs it (RIN-679), so a
 * false positive only costs a lazy chunk while a false negative would show raw
 * LaTeX. remark-math needs an opening and a closing `$`, so content counts as
 * math when it has at least two unescaped dollar signs (`$x$`, `$$x$$`). A dollar
 * escaped with an odd number of backslashes (`\$5`) is literal text.
 */
export function hasMath(content: string): boolean {
  if (!content) {
    return false;
  }
  if (LATEX_DELIMITER.test(content)) {
    return true;
  }

  let unescapedDollars = 0;
  let backslashes = 0;
  for (const char of content) {
    if (char === '\\') {
      backslashes += 1;
      continue;
    }
    if (char === '$' && backslashes % 2 === 0) {
      unescapedDollars += 1;
      if (unescapedDollars >= 2) {
        return true;
      }
    }
    backslashes = 0;
  }
  return false;
}
