import { describe, expect, it } from 'vitest';
import { replaceLastAssistantMessage, type ChatMessage } from './chat-history';

const history: ChatMessage[] = [
  { role: 'user', content: 'First', timestamp: '2026-07-01T00:00:00.000Z' },
  { role: 'assistant', content: 'Answer one', timestamp: '2026-07-01T00:00:01.000Z' },
  { role: 'user', content: 'Second', timestamp: '2026-07-01T00:00:02.000Z' },
  { role: 'assistant', content: 'Answer two', timestamp: '2026-07-01T00:00:03.000Z' },
];

describe('replaceLastAssistantMessage', () => {
  it('updates only the most recent assistant message', () => {
    expect(replaceLastAssistantMessage(history, 'Streamed answer')).toEqual([
      history[0],
      history[1],
      history[2],
      { ...history[3], content: 'Streamed answer' },
    ]);
    expect(history[3]?.content).toBe('Answer two');
  });

  it('leaves a history without an assistant message unchanged', () => {
    const userOnly: ChatMessage[] = [
      { role: 'user', content: 'Only user', timestamp: '2026-07-01T00:00:00.000Z' },
    ];
    expect(replaceLastAssistantMessage(userOnly, 'ignored')).toEqual(userOnly);
  });
});
