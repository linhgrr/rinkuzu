import { describe, expect, it } from 'vitest';
import { isQuizAttemptPath, shouldBlockQuizClipboard } from './browser-protection';

describe('browser protection', () => {
  it.each([
    ['/vi/quiz/networking-basics', true],
    ['/en/quiz/networking-basics/', true],
    ['/quiz/networking-basics', true],
    ['/vi/quiz/networking-basics/result', false],
    ['/vi/quiz/networking-basics/flashcards', false],
    ['/vi/quizzes', false],
    ['/vi/edit/networking-basics', false],
  ])('recognizes quiz attempt path %s', (pathname, expected) => {
    expect(isQuizAttemptPath(pathname)).toBe(expected);
  });

  it('blocks clipboard events on quiz attempt content', () => {
    const questionContent = document.createElement('div');

    expect(shouldBlockQuizClipboard('/vi/quiz/networking-basics', questionContent)).toBe(true);
  });

  it('keeps email paste available before a guest starts the quiz', () => {
    const emailInput = document.createElement('input');
    emailInput.type = 'email';

    expect(shouldBlockQuizClipboard('/vi/quiz/networking-basics', emailInput)).toBe(false);
  });

  it('does not block clipboard outside the quiz attempt route', () => {
    const content = document.createElement('div');

    expect(shouldBlockQuizClipboard('/vi/quiz/networking-basics/result', content)).toBe(false);
  });
});
