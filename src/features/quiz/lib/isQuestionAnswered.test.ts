import { describe, expect, it } from 'vitest';
import { isQuestionAnswered } from './isQuestionAnswered';

describe('isQuestionAnswered', () => {
  it.each([
    {
      name: 'single unanswered sentinel',
      question: { type: 'single' as const },
      answer: -1 as const,
      expected: false,
    },
    {
      name: 'single selected option',
      question: { type: 'single' as const },
      answer: 0 as const,
      expected: true,
    },
    {
      name: 'single selected non-zero option',
      question: { type: 'single' as const },
      answer: 3 as const,
      expected: true,
    },
    {
      name: 'single undefined preserves prior !== -1 semantics',
      question: { type: 'single' as const },
      answer: undefined,
      expected: true,
    },
    {
      name: 'multiple empty array',
      question: { type: 'multiple' as const },
      answer: [] as number[],
      expected: false,
    },
    {
      name: 'multiple with selections',
      question: { type: 'multiple' as const },
      answer: [0, 2] as number[],
      expected: true,
    },
    {
      name: 'multiple undefined',
      question: { type: 'multiple' as const },
      answer: undefined,
      expected: false,
    },
    {
      name: 'multiple with single-number answer is not answered',
      question: { type: 'multiple' as const },
      answer: 1 as const,
      expected: false,
    },
  ])('$name', ({ question, answer, expected }) => {
    expect(isQuestionAnswered(question, answer)).toBe(expected);
  });
});
