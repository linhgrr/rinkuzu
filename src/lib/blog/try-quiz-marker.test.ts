import { describe, expect, it } from 'vitest';
import { findUnsafeBodyConstruct } from './body-safety';
import { blogFrontmatterSchema } from './schema';
import { hasInlineTryQuiz, isTryQuizLine, splitBlogBody } from './try-quiz-marker';

// RIN-1258: `<TryQuiz />` is the one tag a plain-Markdown blog body accepts,
// as a whole line outside code, and the `quiz` frontmatter block feeds the card.

const FRONTMATTER = {
  title: 'Fake post',
  description: 'Fake description',
  date: '2026-01-15',
  category: 'Study',
  readTimeMinutes: 4,
  heroImage: 'https://example.com/hero.png',
  heroImageAlt: 'Hero',
  locale: 'en',
  author: 'fake-author',
};

const issuesOf = (quiz: unknown): string[] => {
  const result = blogFrontmatterSchema.safeParse({ ...FRONTMATTER, quiz });
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
};

describe('blog frontmatter quiz block', () => {
  it('accepts a slug and a 140-character teaser, or an empty block', () => {
    expect(issuesOf({ slug: 'fake-quiz-1', teaser: 'x'.repeat(140) })).toEqual([]);
    expect(issuesOf({})).toEqual([]);
    expect(blogFrontmatterSchema.safeParse(FRONTMATTER).success).toBe(true);
  });

  it('rejects a 141-character teaser with a clear message', () => {
    expect(issuesOf({ teaser: 'x'.repeat(141) })).toEqual([
      'quiz.teaser: quiz.teaser must be at most 140 characters',
    ]);
  });

  it.each(['Bad_Slug', 'has space', 'a'.repeat(81), ''])('rejects the slug %j', (slug) => {
    expect(issuesOf({ slug })).toEqual([
      'quiz.slug: quiz.slug must be a quiz slug: lowercase letters, numbers and hyphens, at most 80',
    ]);
  });

  it('rejects unknown keys so a typo does not silently drop the card copy', () => {
    expect(issuesOf({ teaserr: 'typo' })).toHaveLength(1);
  });
});

describe('<TryQuiz /> marker', () => {
  it.each(['<TryQuiz />', '  <TryQuiz/>  ', '<TryQuiz teaser="How much do you remember?" />'])(
    'accepts %j as a marker line the body check allows',
    (line) => {
      expect(isTryQuizLine(line)).toBe(true);
      expect(findUnsafeBodyConstruct(`Intro\n\n${line}\n\nOutro`)).toBeUndefined();
    },
  );

  it.each([
    'Read this <TryQuiz />',
    '<TryQuiz slug="x" />',
    '<TryQuiz teaser="{evil}" />',
    `<TryQuiz teaser="${'x'.repeat(141)}" />`,
    '<TryQuiz>',
  ])('still rejects %j as a raw tag', (line) => {
    expect(isTryQuizLine(line)).toBe(false);
    expect(findUnsafeBodyConstruct(line)).toBeDefined();
  });

  it('splits the body at each marker and keeps the teaser override', () => {
    const segments = splitBlogBody(
      '# One\n\nText\n\n<TryQuiz teaser="Quick check" />\n\n## Two\n\n<TryQuiz />\n',
    );

    expect(segments).toEqual([
      { kind: 'markdown', content: '# One\n\nText\n' },
      { kind: 'try-quiz', teaser: 'Quick check' },
      { kind: 'markdown', content: '\n## Two\n' },
      { kind: 'try-quiz' },
    ]);
    expect(hasInlineTryQuiz(segments)).toBe(true);
  });

  it('leaves a marker inside fenced code as code', () => {
    const body = 'Write:\n\n```mdx\n<TryQuiz />\n```\n';

    expect(splitBlogBody(body)).toEqual([{ kind: 'markdown', content: body }]);
    expect(hasInlineTryQuiz(splitBlogBody(body))).toBe(false);
  });
});
