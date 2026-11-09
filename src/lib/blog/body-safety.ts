/**
 * Blog bodies are data, not code (RIN-1329). They are rendered by
 * react-markdown (`skipHtml`), never compiled as MDX, so anything that only
 * means something to an MDX compiler or a browser (ESM, `{expressions}`, JSX or
 * HTML tags, `javascript:` links) is rejected when posts load. That keeps a
 * content-only PR from smuggling code onto the site and fails CI on it instead
 * of silently dropping it from the page.
 *
 * Fenced code blocks and inline code spans are exempt: a post may show code.
 */

type UnsafeBodyConstruct = { line: number; reason: string };

const ALLOWED_URL_SCHEMES = new Set(['http', 'https', 'mailto']);

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;
// MDX ESM: `import x from '...'`, `import '...'`, `export const ...`.
const ESM_PATTERN =
  /^\s*(?:import\s+(?:[\w*{][^'"]*\s+from\s+)?['"]|export\s+(?:const|let|var|function|class|default|async|\{|\*))/;
// `<div`, `</div>`, `<Foo.Bar />`, `<!--`, fragments. Autolinks (`<https://x>`,
// `<a@b.c>`) and comparisons (`a < b`) do not match.
const TAG_PATTERN = /<\/?[A-Za-z][\w.-]*(?=[\s/>]|$)|<!--|<\/?>/;
// Backslash-escaped ASCII punctuation renders literally (`\{`, `\<`).
const ESCAPE_PATTERN = /\\[!-/:-@[-`{-~]/g;
const CODE_SPAN_PATTERN = /(`+)[\s\S]*?\1/g;
const INLINE_URL_PATTERN = /\]\(\s*<?([^\s)>]+)/g;
const REFERENCE_URL_PATTERN = /^ {0,3}\[[^\]]+\]:\s*<?([^\s>]+)/;
const AUTOLINK_PATTERN = /<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*)>/g;
const SCHEME_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*):/;

const blank = (match: string): string => ' '.repeat(match.length);

/** The line as Markdown sees it outside code: escapes and code spans blanked. */
const proseOf = (line: string): string =>
  line.replace(ESCAPE_PATTERN, blank).replace(CODE_SPAN_PATTERN, blank);

const linkUrlsOf = (prose: string): string[] => {
  const urls = [...prose.matchAll(INLINE_URL_PATTERN), ...prose.matchAll(AUTOLINK_PATTERN)].map(
    (match) => match[1] ?? '',
  );
  const reference = REFERENCE_URL_PATTERN.exec(prose)?.[1];
  return reference ? [...urls, reference] : urls;
};

const disallowedScheme = (url: string): string | undefined => {
  const scheme = SCHEME_PATTERN.exec(url)?.[1]?.toLowerCase();
  return scheme && !ALLOWED_URL_SCHEMES.has(scheme) ? scheme : undefined;
};

const checkProseLine = (prose: string): string | undefined => {
  if (ESM_PATTERN.test(prose)) {
    return 'import/export statement';
  }
  if (/[{}]/.test(prose)) {
    return 'JSX/MDX expression `{...}` (escape it as `\\{` to show a brace)';
  }
  const tag = TAG_PATTERN.exec(prose)?.[0];
  if (tag) {
    return `raw HTML/JSX tag \`${tag}\``;
  }
  for (const url of linkUrlsOf(prose)) {
    const scheme = disallowedScheme(url);
    if (scheme) {
      return `link URL scheme \`${scheme}:\` (only http, https, mailto or relative)`;
    }
  }
  return undefined;
};

type Fence = { char: string; length: number };

const openingFence = (line: string): Fence | undefined => {
  const marker = FENCE_PATTERN.exec(line)?.[1];
  return marker ? { char: marker.charAt(0), length: marker.length } : undefined;
};

const closesFence = (line: string, fence: Fence): boolean => {
  const marker = FENCE_PATTERN.exec(line)?.[1];
  return (
    marker !== undefined &&
    marker.charAt(0) === fence.char &&
    marker.length >= fence.length &&
    line.trim() === marker
  );
};

/**
 * Returns the first construct in a Markdown body that is code rather than
 * content, with its 1-based line number within the body, or `undefined`.
 */
export const findUnsafeBodyConstruct = (body: string): UnsafeBodyConstruct | undefined => {
  const lines = body.split(/\r?\n/);
  let fence: Fence | undefined;

  for (const [index, line] of lines.entries()) {
    if (fence) {
      fence = closesFence(line, fence) ? undefined : fence;
      continue;
    }
    fence = openingFence(line);
    if (fence) {
      continue;
    }
    const reason = checkProseLine(proseOf(line));
    if (reason) {
      return { line: index + 1, reason };
    }
  }
  return undefined;
};
