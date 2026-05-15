import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();
const sharedDateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};
const prebuiltDateTimeFormatters = {
  default: new Intl.DateTimeFormat(undefined, sharedDateTimeFormatOptions),
  en: new Intl.DateTimeFormat('en', sharedDateTimeFormatOptions),
  vi: new Intl.DateTimeFormat('vi', sharedDateTimeFormatOptions),
} as const;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim() +
    '-' +
    Date.now().toString().slice(-6)
  );
}

export function formatDate(date: Date, locale?: string): string {
  const formatterKey = locale?.startsWith('vi')
    ? 'vi'
    : locale?.startsWith('en')
      ? 'en'
      : 'default';
  let formatter = dateTimeFormatterCache.get(formatterKey);

  if (!formatter) {
    formatter = prebuiltDateTimeFormatters[formatterKey];
    dateTimeFormatterCache.set(formatterKey, formatter);
  }

  return formatter.format(date);
}

export function calculateScore(
  userAnswers: (number | number[])[],
  questions: { type: 'single' | 'multiple'; correctIndex?: number; correctIndexes?: number[] }[],
): number {
  let correct = 0;
  let answered = 0; // Track only answered questions for scoring

  for (let i = 0; i < userAnswers.length; i++) {
    const question = questions[i];
    const userAnswer = userAnswers[i];

    if (question.type === 'single') {
      if (typeof userAnswer === 'number' && userAnswer !== -1) {
        answered++;
        if (userAnswer === question.correctIndex) {
          correct++;
        }
      }
    } else if (question.type === 'multiple') {
      if (Array.isArray(userAnswer) && userAnswer.length > 0 && question.correctIndexes) {
        answered++;
        const userSet = new Set(userAnswer.sort());
        const correctSet = new Set(question.correctIndexes.sort());

        if (userSet.size === correctSet.size && [...userSet].every((x) => correctSet.has(x))) {
          correct++;
        }
      }
    }
  }

  if (answered === 0) {
    return 0;
  }

  return Math.round((correct / answered) * 100);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
