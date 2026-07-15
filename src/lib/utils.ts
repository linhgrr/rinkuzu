import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export function calculateScore(
  userAnswers: (number | number[])[],
  questions: { type: 'single' | 'multiple'; correctIndex?: number; correctIndexes?: number[] }[],
): number {
  if (userAnswers.length > questions.length) {
    throw new TypeError('userAnswers cannot contain more entries than questions');
  }

  let correct = 0;
  let answered = 0; // Track only answered questions for scoring

  for (let i = 0; i < userAnswers.length; i++) {
    const question = questions[i];
    const userAnswer = userAnswers[i];
    if (!question) {
      throw new TypeError(`question at index ${i} is required`);
    }

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
        const userSet = new Set(userAnswer);
        const correctSet = new Set(question.correctIndexes);

        if (
          userSet.size === userAnswer.length &&
          correctSet.size === question.correctIndexes.length &&
          userSet.size === correctSet.size &&
          [...userSet].every((x) => correctSet.has(x))
        ) {
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

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
