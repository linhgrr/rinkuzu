import { createHash } from 'node:crypto';
import type { PremiumQuizSnapshot } from '@/entities/PremiumQuiz';
import type { QuizQuestion } from '@/entities/Quiz';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizePremiumText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function canonicalQuestion(question: QuizQuestion): string {
  const answer =
    question.type === 'single'
      ? [question.correctIndex]
      : question.correctIndexes.toSorted((left, right) => left - right);
  return JSON.stringify({
    question: normalizePremiumText(question.question),
    options: question.options.map(normalizePremiumText),
    type: question.type,
    answer,
  });
}

export function hashPremiumQuestion(question: QuizQuestion): string {
  return sha256(canonicalQuestion(question));
}

export function hashPremiumSnapshot(snapshot: PremiumQuizSnapshot): string {
  return sha256(
    JSON.stringify({
      title: normalizePremiumText(snapshot.title),
      description: normalizePremiumText(snapshot.description ?? ''),
      questions: snapshot.questions.map(canonicalQuestion),
    }),
  );
}

function trigrams(value: string): Set<string> {
  const normalized = `  ${normalizePremiumText(value)}  `;
  const values = new Set<string>();
  for (let index = 0; index <= normalized.length - 3; index += 1) {
    values.add(normalized.slice(index, index + 3));
  }
  return values;
}

function snapshotText(snapshot: PremiumQuizSnapshot): string {
  return [
    snapshot.title,
    snapshot.description ?? '',
    ...snapshot.questions.flatMap((question) => [question.question, ...question.options]),
  ].join(' ');
}

export function premiumSnapshotSimilarity(
  left: PremiumQuizSnapshot,
  right: PremiumQuizSnapshot,
): number {
  const leftSet = trigrams(snapshotText(left));
  const rightSet = trigrams(snapshotText(right));
  const union = new Set([...leftSet, ...rightSet]);
  if (union.size === 0) return 1;
  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) intersection += 1;
  }
  return intersection / union.size;
}
