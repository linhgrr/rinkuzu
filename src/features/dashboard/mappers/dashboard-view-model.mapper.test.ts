import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toDashboardViewModel } from '@/features/dashboard/mappers/dashboard-view-model.mapper';
import type { DashboardStatsDto } from '@/dtos/dashboard';

const baseStats: DashboardStatsDto = {
  streak: 0,
  longestStreak: 0,
  streakFreezeCount: 0,
  xp: 0,
  level: 1,
  xpToNextLevel: 100,
  levelProgress: 0,
  dueCount: 0,
  weeklyActivity: {},
  totalQuestionsLearned: 0,
  totalReviewSessions: 0,
  averageAccuracy: 0,
};

const copy = {
  aiLearning: 'AI learning',
  inProgress: 'In progress',
  quizBuilderTitle: 'Quiz builder',
  recentlyUpdated: 'Recently updated',
  today: 'Today',
  dayAgo: (count: number) => `${count} day ago`,
  daysAgo: (count: number) => `${count} days ago`,
  weekdayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

describe('toDashboardViewModel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps progress without presentation fallback numbers', () => {
    const viewModel = toDashboardViewModel({
      userName: 'Learner',
      stats: baseStats,
      adaptiveSubjects: [],
      inProgressQuizzes: [],
      recentOwnedQuizzes: [],
      recentPublicQuizzes: [],
      isNewLearner: false,
      starterQuizzes: [],
      locale: 'en',
      copy,
    });

    expect(viewModel.progress).toMatchObject({
      streak: 0,
      accuracyPercent: 0,
      studyHours: 0,
      dueCount: 0,
    });
  });

  it('builds learning cards from validated DTO data at the dashboard boundary', () => {
    const viewModel = toDashboardViewModel({
      userName: 'Learner',
      stats: {
        ...baseStats,
        averageAccuracy: 82.4,
        totalReviewSessions: 3,
      },
      adaptiveSubjects: [
        {
          job_id: 'job-1',
          subject_id: 'Physics',
          filename: 'ignored.pdf',
          status: 'completed',
          concepts_extracted: 4,
          concepts_after_merge: 4,
          relations_accepted: 0,
          relations_llm_verified: 0,
          relations_deterministic_unverified: 0,
          progress_percent: 20,
          all_concept: 4,
          unlocked_concept: 4,
          locked_concept: 0,
          mastered_concept: 3,
          completed_at: 1782972000,
        },
      ],
      inProgressQuizzes: [
        {
          quizId: 'quiz-1',
          title: 'Algebra',
          slug: 'algebra',
          answeredCount: 1,
          totalQuestions: 4,
          updatedAt: '2026-07-01T12:00:00.000Z',
        },
        {
          quizId: 'invalid-quiz',
          title: 'Invalid',
          slug: '',
          answeredCount: 0,
          totalQuestions: 0,
          updatedAt: '2026-07-01T12:00:00.000Z',
        },
      ],
      recentOwnedQuizzes: [],
      recentPublicQuizzes: [],
      isNewLearner: false,
      starterQuizzes: [],
      locale: 'en',
      copy,
    });

    expect(viewModel.progress).toMatchObject({
      accuracyPercent: 82,
      studyHours: 2,
    });
    expect(viewModel.continueLearning.items).toEqual([
      expect.objectContaining({
        id: 'in-progress-quiz-1',
        title: 'Algebra',
        category: 'In progress',
        progress: 25,
        href: '/quiz/algebra',
        tone: 'cool',
      }),
      expect.objectContaining({
        id: 'adaptive-job-1',
        title: 'Physics',
        category: 'AI learning',
        progress: 75,
        tone: 'warm',
      }),
    ]);
  });

  it('maps recent quiz sections through the shared quiz view model', () => {
    const quiz = {
      id: 'quiz-1',
      title: 'Algebra',
      slug: 'algebra',
      author: null,
      folder: null,
      visibility: 'public' as const,
      questionCount: 4,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    };
    const viewModel = toDashboardViewModel({
      userName: 'Learner',
      stats: { ...baseStats, dueCount: 3 },
      adaptiveSubjects: [],
      inProgressQuizzes: [],
      recentOwnedQuizzes: [quiz],
      recentPublicQuizzes: [{ ...quiz, id: 'quiz-2', slug: 'geometry', title: 'Geometry' }],
      isNewLearner: false,
      starterQuizzes: [],
      locale: 'en',
      copy,
    });

    expect(viewModel.progress.dueCount).toBe(3);
    expect(viewModel.recentOwnedQuizzes).toEqual([
      expect.objectContaining({ id: 'quiz-1', folderId: null }),
    ]);
    expect(viewModel.recentPublicQuizzes).toEqual([
      expect.objectContaining({ id: 'quiz-2', title: 'Geometry' }),
    ]);
  });

  describe('starter quizzes', () => {
    const starterQuizzes = [
      { slug: 'fake-vi-1', title: 'Fake VI 1', questionCount: 10, locale: 'vi', quick: false },
      { slug: 'fake-en-1', title: 'Fake EN 1', questionCount: 8, locale: 'en', quick: false },
      { slug: 'fake-vi-2', title: 'Fake VI 2', questionCount: 12, locale: 'vi', quick: false },
      { slug: 'fake-en-2', title: 'Fake EN 2', questionCount: 5, locale: 'en', quick: false },
    ];

    function build(input: {
      isNewLearner: boolean;
      locale: string;
      starters?: typeof starterQuizzes;
    }) {
      return toDashboardViewModel({
        userName: 'Learner',
        stats: baseStats,
        adaptiveSubjects: [],
        inProgressQuizzes: [],
        recentOwnedQuizzes: [],
        recentPublicQuizzes: [],
        isNewLearner: input.isNewLearner,
        starterQuizzes: input.starters ?? starterQuizzes,
        locale: input.locale,
        copy,
      });
    }

    it('points a new learner at the first starter in their locale, with alternatives in that locale only', () => {
      // RIN-988: the /en dashboard listed a vi-titled starter.
      const viewModel = build({ isNewLearner: true, locale: 'en' });

      expect(viewModel.starter?.primary).toEqual({
        slug: 'fake-en-1',
        title: 'Fake EN 1',
        questionCount: 8,
        href: '/quiz/fake-en-1',
      });
      expect(viewModel.starter?.alternatives.map((quiz) => quiz.slug)).toEqual(['fake-en-2']);
      expect(viewModel.heroCtaHref).toBe('/quiz/fake-en-1');
    });

    it('lists only vi starters on the vi dashboard', () => {
      const viewModel = build({ isNewLearner: true, locale: 'vi' });

      expect(viewModel.starter?.primary.slug).toBe('fake-vi-1');
      expect(viewModel.starter?.alternatives.map((quiz) => quiz.slug)).toEqual(['fake-vi-2']);
    });

    it('falls back to the first starter when none matches the locale', () => {
      const viewModel = build({
        isNewLearner: true,
        locale: 'en',
        starters: starterQuizzes.slice(0, 1),
      });

      expect(viewModel.starter?.primary.slug).toBe('fake-vi-1');
      expect(viewModel.starter?.alternatives).toEqual([]);
      expect(viewModel.heroCtaHref).toBe('/quiz/fake-vi-1');
    });

    it('keeps the hero on /adaptive and hides the block for a graduated learner', () => {
      const viewModel = build({ isNewLearner: false, locale: 'vi' });

      expect(viewModel.starter).toBeNull();
      expect(viewModel.heroCtaHref).toBe('/adaptive');
    });

    it('links a quick starter to its quick round', () => {
      const viewModel = build({
        isNewLearner: true,
        locale: 'en',
        starters: [
          { slug: 'fake-long', title: 'Long', questionCount: 10, locale: 'en', quick: true },
        ],
      });

      expect(viewModel.starter?.primary.href).toBe('/quiz/fake-long?mode=quick');
      expect(viewModel.starter?.primary.questionCount).toBe(10);
      expect(viewModel.heroCtaHref).toBe('/quiz/fake-long?mode=quick');
    });

    it('keeps the hero on /adaptive when every starter was dropped', () => {
      const viewModel = build({ isNewLearner: true, locale: 'vi', starters: [] });

      expect(viewModel.starter).toBeNull();
      expect(viewModel.heroCtaHref).toBe('/adaptive');
    });
  });
});
