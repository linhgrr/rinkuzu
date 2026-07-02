import { z } from 'zod';

const CHAT_HISTORY_KEY_PREFIX = 'quiz_chat_history:v1';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.iso.datetime(),
});

const chatHistoriesSchema = z.record(z.string(), z.array(chatMessageSchema));

export type StoredChatHistories = z.infer<typeof chatHistoriesSchema>;

export type ChatHistoryPersistence = { scope: 'attempt'; id: string } | { scope: 'bookmarks' };

function getStorageKey(persistence: ChatHistoryPersistence): string {
  return persistence.scope === 'attempt'
    ? `${CHAT_HISTORY_KEY_PREFIX}:attempt:${encodeURIComponent(persistence.id)}`
    : `${CHAT_HISTORY_KEY_PREFIX}:bookmarks`;
}

export function readChatHistories(persistence: ChatHistoryPersistence): StoredChatHistories {
  const storageKey = getStorageKey(persistence);
  const value = localStorage.getItem(storageKey);

  if (!value) {
    return {};
  }

  try {
    const result = chatHistoriesSchema.safeParse(JSON.parse(value));
    if (result.success) {
      return result.data;
    }
  } catch {
    // Invalid browser state is deleted below.
  }

  localStorage.removeItem(storageKey);
  return {};
}

export function writeChatHistories(
  persistence: ChatHistoryPersistence,
  chatHistories: StoredChatHistories,
): void {
  const storageKey = getStorageKey(persistence);
  if (Object.keys(chatHistories).length === 0) {
    localStorage.removeItem(storageKey);
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(chatHistories));
}
