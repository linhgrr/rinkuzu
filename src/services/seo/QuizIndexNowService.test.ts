import { describe, expect, it, vi } from 'vitest';

import type { Quiz } from '@/entities/Quiz';
import type { QuizMetadataRecord } from '@/interfaces/repositories/IQuizRepository';
import type { QuizTopicRecord } from '@/interfaces/repositories/IQuizTopicAdminRepository';
import type { QuizIndexNowChange } from '@/interfaces/services/IIndexNowNotifier';
import { canonicalFor } from '@/lib/seo';
import { QuizIndexNowService } from '@/services/seo/QuizIndexNowService';

const QUIZ_ID = '507f191e810c19729de860ea';
const QUIZ_URL = canonicalFor('vi', '/quiz/fake-sinh-hoc');
const HUB_URL = canonicalFor('vi', '/explore/fake-topic');

function quiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: QUIZ_ID,
    title: 'Fake sinh học',
    slug: 'fake-sinh-hoc',
    author: 'fake-owner',
    questions: [],
    questionCount: 8,
    visibility: 'public',
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    ...overrides,
  };
}

const TOPIC: QuizTopicRecord = {
  id: 'fake-topic-id',
  slug: 'fake-topic',
  locale: 'vi',
  name: 'Fake topic',
  intro: '',
  order: 0,
  published: true,
};

function service(record: QuizMetadataRecord | null, topic: QuizTopicRecord | null = TOPIC) {
  return new QuizIndexNowService({
    quizzes: {
      findMetadataBySlug: vi.fn(async (slug: string) =>
        record?.quiz.slug === slug ? record : null,
      ),
      findById: vi.fn(async (id: string) => (record?.quiz.id === id ? record.quiz : null)),
    },
    topics: { findPublishedTopicByQuizId: vi.fn(async () => topic) },
  });
}

const FLIP: QuizIndexNowChange = { quizId: QUIZ_ID, slug: 'fake-sinh-hoc', cause: 'indexability' };
const HOLD: QuizIndexNowChange = { ...FLIP, cause: 'index-hold' };
const MADE_PUBLIC: QuizIndexNowChange = { quizId: QUIZ_ID, cause: 'made-public' };

describe('QuizIndexNowService.urlsFor (RIN-1500)', () => {
  it('returns the quiz page in its own language and its published hub', async () => {
    const urls = await service({ quiz: quiz(), owner: null }).urlsFor(FLIP);
    expect(urls).toEqual([QUIZ_URL, HUB_URL]);
  });

  it('returns only the quiz page when it has no published hub', async () => {
    expect(await service({ quiz: quiz(), owner: null }, null).urlsFor(FLIP)).toEqual([QUIZ_URL]);
  });

  it('uses the English page for an English quiz', async () => {
    const record = { quiz: quiz({ title: 'Fake biology', slug: 'fake-biology' }), owner: null };
    const urls = await service(record, null).urlsFor({ ...FLIP, slug: 'fake-biology' });
    expect(urls).toEqual([canonicalFor('en', '/quiz/fake-biology')]);
  });

  it('sends a flip of a now-hidden quiz, so the engine sees the noindex', async () => {
    const record = { quiz: quiz({ visibility: 'personal' }), owner: null };
    expect(await service(record).urlsFor(FLIP)).toEqual([QUIZ_URL, HUB_URL]);
  });

  it('returns nothing for a test account quiz, a missing quiz or a reused slug', async () => {
    const testOwner = { id: 'fake-owner', isTestAccount: true };
    expect(await service({ quiz: quiz(), owner: testOwner }).urlsFor(FLIP)).toEqual([]);
    expect(await service(null).urlsFor(FLIP)).toEqual([]);
    const other = { quiz: quiz({ id: '507f191e810c19729de860eb' }), owner: null };
    expect(await service(other).urlsFor(FLIP)).toEqual([]);
  });

  it('sends a hold change only when the quiz is otherwise indexable', async () => {
    expect(await service({ quiz: quiz(), owner: null }).urlsFor(HOLD)).toEqual([QUIZ_URL, HUB_URL]);
    const hidden = { quiz: quiz({ visibility: 'personal' }), owner: null };
    expect(await service(hidden).urlsFor(HOLD)).toEqual([]);
    const thin = { quiz: quiz({ questionCount: 3 }), owner: null };
    expect(await service(thin).urlsFor(HOLD)).toEqual([]);
    const flagged = {
      quiz: quiz({
        contentFlags: { personalData: true, kinds: ['phone'], checkedAt: new Date() },
      }),
      owner: null,
    };
    expect(await service(flagged).urlsFor(HOLD)).toEqual([]);
  });

  it('reads the slug of a quiz made public and sends it when it is indexable', async () => {
    expect(await service({ quiz: quiz(), owner: null }).urlsFor(MADE_PUBLIC)).toEqual([
      QUIZ_URL,
      HUB_URL,
    ]);
    expect(await service(null).urlsFor(MADE_PUBLIC)).toEqual([]);
  });

  it('sends nothing for a quiz made public that is held, thin, flagged or still hidden', async () => {
    const held = {
      quiz: quiz({ indexHold: { reason: 'reported', since: new Date('2026-11-01T00:00:00Z') } }),
      owner: null,
    };
    const thin = { quiz: quiz({ questionCount: 3 }), owner: null };
    const flagged = {
      quiz: quiz({
        contentFlags: { personalData: true, kinds: ['phone'], checkedAt: new Date() },
      }),
      owner: null,
    };
    const hidden = { quiz: quiz({ visibility: 'personal' }), owner: null };
    for (const record of [held, thin, flagged, hidden]) {
      expect(await service(record).urlsFor(MADE_PUBLIC)).toEqual([]);
    }
  });
});
