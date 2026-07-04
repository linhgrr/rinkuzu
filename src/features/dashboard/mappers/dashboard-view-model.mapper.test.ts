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
      locale: 'en',
      copy,
    });

    expect(viewModel.progress).toMatchObject({
      streak: 0,
      accuracyPercent: 0,
      studyHours: 0,
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
          relations_verified: 0,
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
});
