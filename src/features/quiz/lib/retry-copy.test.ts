import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import enQuiz from '../../../../messages/en/quiz.json';
import viQuiz from '../../../../messages/vi/quiz.json';

// RIN-917 review: the retry pill must read "1 question", not "1 questions".
describe('retry pill copy', () => {
  const en = createTranslator({ locale: 'en', messages: { quiz: enQuiz }, namespace: 'quiz' });
  const vi = createTranslator({ locale: 'vi', messages: { quiz: viQuiz }, namespace: 'quiz' });

  it('uses the singular for one missed question in English', () => {
    expect(en('resultActions.retryPill', { count: 1 })).toBe('Retry: 1 question');
    expect(en('resultActions.retryPill', { count: 3 })).toBe('Retry: 3 questions');
  });

  it('keeps the Vietnamese copy', () => {
    expect(vi('resultActions.retryPill', { count: 1 })).toBe('Làm lại câu sai · 1 câu');
  });
});
