export interface QuizDateGroupInput {
  createdAt: Date;
  displayDate?: string;
}

export interface QuizWeekGroup<T> {
  key: string;
  startDate: Date;
  endDate: Date;
  quizzes: T[];
}

export interface QuizMonthGroup<T> {
  key: string;
  date: Date;
  weeks: QuizWeekGroup<T>[];
}

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const daySinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daySinceMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function groupQuizzesByMonthAndWeek<T extends QuizDateGroupInput>(
  quizzes: T[],
): QuizMonthGroup<T>[] {
  const months = new Map<string, { date: Date; weeks: Map<string, QuizWeekGroup<T>> }>();

  for (const quiz of quizzes) {
    const date = new Date(quiz.displayDate ?? quiz.createdAt);
    const monthDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthKey = dateKey(monthDate);
    const weekStart = startOfWeek(date);
    const weekKey = dateKey(weekStart);
    const month = months.get(monthKey) ?? { date: monthDate, weeks: new Map() };
    const week = month.weeks.get(weekKey) ?? {
      key: weekKey,
      startDate: weekStart,
      endDate: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6),
      quizzes: [],
    };

    week.quizzes.push(quiz);
    month.weeks.set(weekKey, week);
    months.set(monthKey, month);
  }

  return Array.from(months.entries())
    .map(([key, month]) => ({
      key,
      date: month.date,
      weeks: Array.from(month.weeks.values()).toSorted(
        (a, b) => b.startDate.getTime() - a.startDate.getTime(),
      ),
    }))
    .toSorted((a, b) => b.date.getTime() - a.date.getTime());
}
