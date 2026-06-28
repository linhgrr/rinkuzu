import { describe, expect, it } from 'vitest';
import { groupQuizzesByMonthAndWeek } from './quizDateGroups';

interface TestQuiz {
  id: string;
  createdAt: Date;
  displayDate?: string;
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

    expect(groups).toHaveLength(2);
    expect(groups[0].date).toEqual(new Date(2026, 6, 1));
    expect(groups[0].weeks[0].quizzes.map((quiz) => quiz.id)).toEqual(['next-month']);
    expect(groups[1].weeks).toHaveLength(2);
    expect(groups[1].weeks[0].quizzes.map((quiz) => quiz.id)).toEqual(['monday', 'sunday']);
    expect(groups[1].weeks[0].startDate).toEqual(new Date(2026, 5, 22));
    expect(groups[1].weeks[0].endDate).toEqual(new Date(2026, 5, 28));
  });

  it('uses displayDate when the quiz has recent activity', () => {
    const groups = groupQuizzesByMonthAndWeek([
      {
        id: 'active',
        createdAt: new Date(2026, 4, 1, 12),
        displayDate: new Date(2026, 5, 25, 12).toISOString(),
      },
    ]);

    expect(groups[0].date).toEqual(new Date(2026, 5, 1));
    expect(groups[0].weeks[0].quizzes[0].id).toBe('active');
  });

  it('sorts months and weeks from newest to oldest', () => {
    const groups = groupQuizzesByMonthAndWeek([
      { id: 'oldest', createdAt: new Date(2026, 4, 5, 12) },
      { id: 'newest', createdAt: new Date(2026, 5, 25, 12) },
      { id: 'middle', createdAt: new Date(2026, 5, 9, 12) },
    ]);

    expect(groups.map((group) => group.date.getMonth())).toEqual([5, 4]);
    expect(groups[0].weeks.map((week) => week.quizzes[0].id)).toEqual(['newest', 'middle']);
  });
});
