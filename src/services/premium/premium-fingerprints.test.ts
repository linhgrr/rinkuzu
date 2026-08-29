import { describe, expect, it } from 'vitest';
import type { PremiumQuizSnapshot } from '@/entities/PremiumQuiz';
import {
  hashPremiumQuestion,
  hashPremiumSnapshot,
  premiumSnapshotSimilarity,
} from '@/services/premium/premium-fingerprints';

function snapshot(title: string, question: string): PremiumQuizSnapshot {
  return {
    title,
    slug: 'ignored-by-fingerprint',
    questions: [
      {
        id: 'q1',
        question,
        options: ['Ba', 'Bốn'],
        type: 'single',
        correctIndex: 1,
      },
    ],
  };
}

describe('Premium quiz fingerprints', () => {
  it('normalizes Vietnamese accents, case, and punctuation deterministically', () => {
    // Accents, case, separators and trailing punctuation all have to fall out
    // of the fingerprint, which is the only place the normalization is visible.
    expect(hashPremiumSnapshot(snapshot('Toán học', 'Hai cộng hai?'))).toBe(
      hashPremiumSnapshot(snapshot('TOAN-HOC', 'Hai, cộng HAI ?')),
    );
    expect(hashPremiumSnapshot(snapshot('Đáp án', ' Bốn! '))).toBe(
      hashPremiumSnapshot(snapshot('dap an', 'bon')),
    );
  });

  it('includes answer correctness in each question hash', () => {
    const first = snapshot('Quiz', '2 + 2?').questions[0];
    if (!first) throw new Error('Expected a question');
    if (first.type !== 'single') throw new Error('Expected a single-choice question');
    expect(hashPremiumQuestion(first)).not.toBe(hashPremiumQuestion({ ...first, correctIndex: 0 }));
  });

  it('ranks near-identical content above unrelated content', () => {
    const original = snapshot('Phép cộng cơ bản', 'Hai cộng hai bằng bao nhiêu?');
    const similar = snapshot('Phép cộng cơ bản', 'Hai cộng 2 bằng bao nhiêu');
    const unrelated = snapshot('Sinh học tế bào', 'Ti thể có chức năng gì?');
    expect(premiumSnapshotSimilarity(original, similar)).toBeGreaterThan(0.7);
    expect(premiumSnapshotSimilarity(original, unrelated)).toBeLessThan(0.4);
  });
});
