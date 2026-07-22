import { fetchApiData } from '@/lib/api/client';
import type { AskRinContextRequest } from '@/dtos/ask-rin-chan';

export type AskRinContextPayload = AskRinContextRequest;

export interface AskRinContextCredentials {
  exerciseContextId: string;
  exerciseContextToken: string;
}

interface AskRinMessage {
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'complete' | 'interrupted';
  createdAt: string;
}

export interface AskRinConversation {
  conversationId: string;
  exerciseContextId: string;
  messages: AskRinMessage[];
}

export function registerAskRinContext(
  payload: AskRinContextRequest,
): Promise<AskRinContextCredentials> {
  return fetchApiData('/api/ask-rin-chan/contexts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getAskRinConversation(
  exerciseContextId: string,
  signal?: AbortSignal,
): Promise<AskRinConversation | null> {
  return fetchApiData(
    `/api/ask-rin-chan/conversations/${encodeURIComponent(exerciseContextId)}`,
    signal ? { signal } : undefined,
  );
}

export async function deleteAskRinConversation(exerciseContextId: string): Promise<boolean> {
  const result = await fetchApiData<{ deleted: boolean }>(
    `/api/ask-rin-chan/conversations/${encodeURIComponent(exerciseContextId)}`,
    { method: 'DELETE' },
  );
  return result.deleted;
}
