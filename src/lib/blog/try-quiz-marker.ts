import { closesFence, openingFence, type Fence } from './body-fences';

/**
 * `<TryQuiz />` in a blog body (RIN-1258, spec RIN-1242): a line holding only the
 * marker, optionally with a `teaser="..."` override, places the quiz card there.
 * Bodies stay plain Markdown (RIN-1329): this is the one tag the loader accepts,
 * and only as a whole line outside code; the page splits the body around it.
 * The teaser may not hold quotes, braces or angle brackets, and is at most 140
 * characters (as `quiz.teaser` in the frontmatter).
 */
const TRY_QUIZ_LINE_PATTERN = /^\s*<TryQuiz(?:\s+teaser="([^"<>{}]{1,140})")?\s*\/>\s*$/;

export type BlogBodySegment =
  | { kind: 'markdown'; content: string }
  | { kind: 'try-quiz'; teaser?: string };

export const isTryQuizLine = (line: string): boolean => TRY_QUIZ_LINE_PATTERN.test(line);

const markerTeaser = (line: string): string | undefined => {
  const teaser = TRY_QUIZ_LINE_PATTERN.exec(line)?.[1]?.trim();
  return teaser ? teaser : undefined;
};

/**
 * Splits a body at each `<TryQuiz />` line outside fenced code. A body without
 * one comes back as a single Markdown segment; empty Markdown runs are dropped.
 */
export const splitBlogBody = (body: string): BlogBodySegment[] => {
  const segments: BlogBodySegment[] = [];
  let run: string[] = [];
  let fence: Fence | undefined;

  const flush = () => {
    const content = run.join('\n');
    if (content.trim()) segments.push({ kind: 'markdown', content });
    run = [];
  };

  for (const line of body.split(/\r?\n/)) {
    if (fence) {
      fence = closesFence(line, fence) ? undefined : fence;
    } else if (isTryQuizLine(line)) {
      flush();
      const teaser = markerTeaser(line);
      segments.push(teaser ? { kind: 'try-quiz', teaser } : { kind: 'try-quiz' });
      continue;
    } else {
      fence = openingFence(line);
    }
    run.push(line);
  }
  flush();
  return segments;
};

/** Whether the body places the card itself, so no automatic end card is added. */
export const hasInlineTryQuiz = (segments: readonly BlogBodySegment[]): boolean =>
  segments.some((segment) => segment.kind === 'try-quiz');
