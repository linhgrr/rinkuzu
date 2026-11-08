import { describe, expect, it } from 'vitest';
import { createHeadingSlugger } from '@/lib/slug';
import { STARTER_QUIZ_SEED } from '../../scripts/migrate-starter-quizzes.mjs';
import { EXPECTED_TITLE, NEW_SLUG, OLD_SLUG } from '../../scripts/reslug-vi-starter-quiz.mjs';

describe('reslug-vi-starter-quiz constants', () => {
  it('derives the new slug from the stored title with the shared helper and the old suffix', () => {
    expect(NEW_SLUG).toBe(
      `${createHeadingSlugger()(EXPECTED_TITLE)}-${OLD_SLUG.split('-').at(-1)}`,
    );
    expect(NEW_SLUG).toBe('cach-ghi-nho-nhung-gi-ban-hoc-quiz-khoi-dong-7-cau-096007');
  });

  it('seeds the starter list with the new slug', () => {
    const slugs = STARTER_QUIZ_SEED.map((entry) => entry.slug);
    expect(slugs).toContain(NEW_SLUG);
    expect(slugs).not.toContain(OLD_SLUG);
  });
});
