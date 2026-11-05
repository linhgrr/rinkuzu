import { describe, expect, it } from 'vitest';
import {
  isQuickRoundEligible,
  QUICK_ROUND_MIN_QUIZ_SIZE,
  QUICK_ROUND_SIZE,
} from '@/shared/constants/quick-round';

describe('quick round constants', () => {
  it('offers a quick round of 10 only on quizzes with more than 15 questions', () => {
    expect(QUICK_ROUND_SIZE).toBe(10);
    expect(QUICK_ROUND_MIN_QUIZ_SIZE).toBe(15);
    expect(isQuickRoundEligible(15)).toBe(false);
    expect(isQuickRoundEligible(16)).toBe(true);
  });
});
