import { describe, expect, it } from 'vitest';
import {
  formatCorrectAnswerLetters,
  formatCorrectAnswerText,
  getCorrectAnswerIndexes,
  getCorrectAnswerOptions,
} from '@/lib/quiz/answer-text';

describe('quiz answer text helpers', () => {
  it('formats a single-choice correct answer from the declared index', () => {
    const question = {
      type: 'single' as const,
      options: ['A', 'B'],
      correctIndex: 1,
    };

    expect(getCorrectAnswerIndexes(question)).toEqual([1]);
    expect(getCorrectAnswerOptions(question)).toEqual(['B']);
    expect(formatCorrectAnswerText(question, 'No answer')).toBe('B');
    expect(formatCorrectAnswerLetters(question, 'N/A')).toBe('B');
  });

  it('formats multiple-choice correct answers in order', () => {
    const question = {
      type: 'multiple' as const,
      options: ['A', 'B', 'C'],
      correctIndexes: [0, 2],
    };

    expect(getCorrectAnswerIndexes(question)).toEqual([0, 2]);
    expect(getCorrectAnswerOptions(question)).toEqual(['A', 'C']);
    expect(formatCorrectAnswerText(question, 'No answer')).toBe('A, C');
    expect(formatCorrectAnswerLetters(question, 'N/A')).toBe('A, C');
  });

  it('uses the explicit empty label when the question has no answer index', () => {
    const question = {
      type: 'single' as const,
      options: ['A', 'B'],
    };

    expect(getCorrectAnswerIndexes(question)).toEqual([]);
    expect(getCorrectAnswerOptions(question)).toEqual([]);
    expect(formatCorrectAnswerText(question, 'No answer')).toBe('No answer');
    expect(formatCorrectAnswerLetters(question, 'N/A')).toBe('N/A');
  });

  it('omits out-of-range option indexes instead of rendering undefined', () => {
    const question = {
      type: 'multiple' as const,
      options: ['A'],
      correctIndexes: [0, 2],
    };

    expect(getCorrectAnswerOptions(question)).toEqual(['A']);
    expect(formatCorrectAnswerText(question, 'No answer')).toBe('A');
  });
});
