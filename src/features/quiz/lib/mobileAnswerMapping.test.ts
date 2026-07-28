import { describe, expect, it } from 'vitest';
import { mapMobileAnswersToOrderedAnswers } from './mobileAnswerMapping';

describe('mapMobileAnswersToOrderedAnswers', () => {
  it('normalizes unanswered multiple-choice questions to empty arrays', () => {
    const quiz: { questions: Array<{ id: string; type: 'single' | 'multiple' }> } = {
      questions: [
        { id: 'q-1', type: 'single' },
        { id: 'q-2', type: 'multiple' },
        { id: 'q-3', type: 'single' },
        { id: 'q-4', type: 'multiple' },
      ],
    };

    expect(mapMobileAnswersToOrderedAnswers(quiz, {})).toEqual([-1, [], -1, []]);
  });

  it('preserves answered single and multiple-choice values', () => {
    const quiz: { questions: Array<{ id: string; type: 'single' | 'multiple' }> } = {
      questions: [
        { id: 'question-a', type: 'single' },
        { id: 'question-b', type: 'multiple' },
      ],
    };

    expect(
      mapMobileAnswersToOrderedAnswers(quiz, {
        'question-a': 2,
        'question-b': [0, 3],
      }),
    ).toEqual([2, [0, 3]]);
  });
});
