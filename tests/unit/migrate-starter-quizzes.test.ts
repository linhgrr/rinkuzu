import { describe, expect, it } from 'vitest';
import { STARTER_QUIZ_SEED, seedStarterQuizzes } from '../../scripts/migrate-starter-quizzes.mjs';

type Row = Record<string, unknown> & { quiz: string };

function fakeDb(slugs: readonly string[]) {
  const quizIds = new Map(slugs.map((slug, index) => [slug, `fake-quiz-${index + 1}`]));
  const rows: Row[] = [];
  const quizzes = {
    findOne: async (filter: Record<string, unknown>) => {
      const id = quizIds.get(String(filter['slug']));
      return id ? { _id: id } : null;
    },
  };
  const starters = {
    findOne: async (filter: Record<string, unknown>) =>
      rows.find((row) => row.quiz === filter['quiz']) ?? null,
    updateOne: async (
      filter: Record<string, unknown>,
      update: { $setOnInsert: Record<string, unknown> },
    ) => {
      if (rows.some((row) => row.quiz === filter['quiz'])) return { upsertedCount: 0 };
      rows.push({ ...update.$setOnInsert, quiz: String(filter['quiz']) });
      return { upsertedCount: 1 };
    },
  };
  return { quizzes, starters, rows };
}

const allSlugs = STARTER_QUIZ_SEED.map(({ slug }) => slug);
const now = new Date('2026-11-08T00:00:00Z');

describe('migrate-starter-quizzes', () => {
  it('seeds the former allowlist in its order: vi, en, vi', () => {
    expect(STARTER_QUIZ_SEED).toEqual([
      {
        slug: 'cach-ghi-nho-nhung-gi-ban-hoc-quiz-khoi-dong-7-cau-096007',
        locale: 'vi',
        order: 1,
      },
      {
        slug: 'how-to-remember-what-you-study-7-question-starter-quiz-093947',
        locale: 'en',
        order: 2,
      },
      { slug: 'ktpm-chuong-6-p1-219991', locale: 'vi', order: 3 },
    ]);
  });

  it('writes nothing on a dry run', async () => {
    const db = fakeDb(allSlugs);

    await expect(seedStarterQuizzes({ ...db, apply: false, now })).resolves.toEqual({
      seed: 3,
      missingQuiz: 0,
      alreadySeeded: 0,
      toInsert: 3,
      inserted: 0,
    });
    expect(db.rows).toEqual([]);
  });

  it('inserts each starter by quiz id once; a second run changes nothing', async () => {
    const db = fakeDb(allSlugs);

    const first = await seedStarterQuizzes({ ...db, apply: true, now });
    const second = await seedStarterQuizzes({ ...db, apply: true, now });

    expect(first).toMatchObject({ toInsert: 3, inserted: 3, alreadySeeded: 0 });
    expect(second).toMatchObject({ toInsert: 0, inserted: 0, alreadySeeded: 3 });
    expect(db.rows.map(({ quiz, locale, order }) => [quiz, locale, order])).toEqual([
      ['fake-quiz-1', 'vi', 1],
      ['fake-quiz-2', 'en', 2],
      ['fake-quiz-3', 'vi', 3],
    ]);
  });

  it('counts a slug with no quiz as missing and seeds the rest', async () => {
    const db = fakeDb(allSlugs.slice(1));

    await expect(seedStarterQuizzes({ ...db, apply: true, now })).resolves.toMatchObject({
      missingQuiz: 1,
      inserted: 2,
    });
  });
});
