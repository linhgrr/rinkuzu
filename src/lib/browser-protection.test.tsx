import { describe, expect, it } from 'vitest';
import { isDevtoolShortcut, shouldBlockQuizClipboard } from './browser-protection';

describe('browser protection', () => {
  it.each([
    [new KeyboardEvent('keydown', { key: 'F12' }), true],
    [new KeyboardEvent('keydown', { key: 'I', ctrlKey: true, shiftKey: true }), true],
    [new KeyboardEvent('keydown', { key: 'J', ctrlKey: true, shiftKey: true }), true],
    [new KeyboardEvent('keydown', { key: 'C', ctrlKey: true, shiftKey: true }), true],
    [new KeyboardEvent('keydown', { key: 'I', metaKey: true, altKey: true }), true],
    [new KeyboardEvent('keydown', { key: 'U', ctrlKey: true }), true],
    [new KeyboardEvent('keydown', { key: 'R', ctrlKey: true }), false],
    [new KeyboardEvent('keydown', { key: 'C', ctrlKey: true }), false],
  ])('recognizes developer-tool shortcut %#', (event, expected) => {
    expect(isDevtoolShortcut(event)).toBe(expected);
  });

  it.each([
    ['/vi/quiz/networking-basics', true],
    ['/en/quiz/networking-basics/', true],
    ['/quiz/networking-basics', true],
    ['/vi/quiz/networking-basics/result', false],
    ['/vi/quiz/networking-basics/flashcards', false],
    ['/vi/quizzes', false],
    ['/vi/edit/networking-basics', false],
  ])('recognizes quiz attempt path %s', (pathname, expected) => {
    // Asserted through the only caller: route recognition exists to decide
    // whether the clipboard is blocked, and a non-email target isolates it.
    expect(shouldBlockQuizClipboard(pathname, document.createElement('div'))).toBe(expected);
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
