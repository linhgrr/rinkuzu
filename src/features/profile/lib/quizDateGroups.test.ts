import { describe, expect, it } from 'vitest';
import { groupQuizzesByMonthAndWeek } from './quizDateGroups';

interface TestQuiz {
  id: string;
  createdAt: Date;
  displayDate?: string;
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

describe('groupQuizzesByMonthAndWeek', () => {
  it('groups quizzes by calendar month, then Monday-based week', () => {
    const quizzes: TestQuiz[] = [
      { id: 'older-week', createdAt: new Date(2026, 5, 16, 12) },
      { id: 'monday', createdAt: new Date(2026, 5, 22, 12) },
      { id: 'sunday', createdAt: new Date(2026, 5, 28, 12) },
      { id: 'next-month', createdAt: new Date(2026, 6, 1, 12) },
    ];

    const groups = groupQuizzesByMonthAndWeek(quizzes);
    const july = required(groups[0], 'July group');
    const june = required(groups[1], 'June group');
    const julyWeek = required(july.weeks[0], 'July week');
    const latestJuneWeek = required(june.weeks[0], 'latest June week');

    expect(groups).toHaveLength(2);
    expect(july.date).toEqual(new Date(2026, 6, 1));
    expect(julyWeek.quizzes.map((quiz) => quiz.id)).toEqual(['next-month']);
    expect(june.weeks).toHaveLength(2);
    expect(latestJuneWeek.quizzes.map((quiz) => quiz.id)).toEqual(['monday', 'sunday']);
    expect(latestJuneWeek.startDate).toEqual(new Date(2026, 5, 22));
    expect(latestJuneWeek.endDate).toEqual(new Date(2026, 5, 28));
  });

  it('uses displayDate when the quiz has recent activity', () => {
    const groups = groupQuizzesByMonthAndWeek([
      {
        id: 'active',
        createdAt: new Date(2026, 4, 1, 12),
        displayDate: new Date(2026, 5, 25, 12).toISOString(),
      },
    ]);
    const month = required(groups[0], 'active month');
    const week = required(month.weeks[0], 'active week');
    const quiz = required(week.quizzes[0], 'active quiz');

    expect(month.date).toEqual(new Date(2026, 5, 1));
    expect(quiz.id).toBe('active');
  });

  it('sorts months and weeks from newest to oldest', () => {
    const groups = groupQuizzesByMonthAndWeek([
      { id: 'oldest', createdAt: new Date(2026, 4, 5, 12) },
      { id: 'newest', createdAt: new Date(2026, 5, 25, 12) },
      { id: 'middle', createdAt: new Date(2026, 5, 9, 12) },
    ]);
    const june = required(groups[0], 'June group');

    expect(groups.map((group) => group.date.getMonth())).toEqual([5, 4]);
    expect(
      june.weeks.map((week, index) => required(week.quizzes[0], `June quiz ${index}`).id),
    ).toEqual(['newest', 'middle']);
  });
});
