import { describe, expect, it } from 'vitest';
import { mapMobileAnswersToOrderedAnswers } from './mobileAnswerMapping';

describe('mapMobileAnswersToOrderedAnswers', () => {
  it('normalizes unanswered multiple-choice questions to empty arrays', () => {
    const quiz: { questions: Array<{ type: 'single' | 'multiple' }> } = {
      questions: [
        { type: 'single' },
        { type: 'multiple' },
        { type: 'single' },
        { type: 'multiple' },
      ],
    };

    expect(mapMobileAnswersToOrderedAnswers(quiz, {})).toEqual([-1, [], -1, []]);
  });

  it('preserves answered single and multiple-choice values', () => {
    const quiz: { questions: Array<{ type: 'single' | 'multiple' }> } = {
      questions: [{ type: 'single' }, { type: 'multiple' }],
    };

    expect(mapMobileAnswersToOrderedAnswers(quiz, { 'q-0': 2, 'q-1': [0, 3] })).toEqual([
      2,
      [0, 3],
    ]);
  });
});
