import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../../../../tests/helpers/storage';
import { readChatHistories, writeChatHistories } from './chat-history-storage';

describe('chat history storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('round-trips validated, versioned chat histories', () => {
    const persistence = { scope: 'attempt', id: 'attempt/1' } as const;
    const histories = {
      '0': [
        {
          role: 'user' as const,
          content: 'Explain this',
          timestamp: '2026-07-02T04:00:00.000Z',
        },
      ],
    };

    writeChatHistories(persistence, histories);

    expect(readChatHistories(persistence)).toEqual(histories);
  });

  it('deletes malformed cached data', () => {
    localStorage.setItem(
      'quiz_chat_history:v1:bookmarks',
      JSON.stringify({ question: [{ role: 'system', content: 42 }] }),
    );

    expect(readChatHistories({ scope: 'bookmarks' })).toEqual({});
    expect(localStorage.getItem('quiz_chat_history:v1:bookmarks')).toBeNull();
  });
});
