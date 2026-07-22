import { describe, expect, it } from 'vitest';
import { isAwaitingFirstAssistantText } from './stream-state';

describe('Ask Rin-chan streaming feedback', () => {
  it('keeps thinking visible for the empty running text part emitted by TEXT_MESSAGE_START', () => {
    expect(isAwaitingFirstAssistantText('assistant', '', 'running')).toBe(true);
  });

  it('hides thinking as soon as the first text delta arrives', () => {
    expect(isAwaitingFirstAssistantText('assistant', 'Đ', 'running')).toBe(false);
  });

  it('does not label a completed empty response as thinking', () => {
    expect(isAwaitingFirstAssistantText('assistant', '', 'complete')).toBe(false);
  });
});
