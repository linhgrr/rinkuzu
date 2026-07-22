'use client';

import { useEffect, useRef, useState } from 'react';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import {
  deleteAskRinConversation,
  getAskRinConversation,
  registerAskRinContext,
  streamAskRinChan,
  type AskRinContextCredentials,
  type AskRinContextPayload,
} from '@/lib/ask-rin-chan/client';
import { replaceLastAssistantMessage, type ChatMessage } from '@/features/quiz/lib/chat-history';

type ChatHistories = Record<string, ChatMessage[]>;

const EMPTY_CHAT_MESSAGES: ChatMessage[] = [];
const LEGACY_HISTORY_PREFIX = 'quiz_chat_history:v1';

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

type StreamQuestionPayload =
  | {
      source?: 'quiz';
      question: string;
      options: string[];
      questionImage?: string;
      optionImages?: (string | undefined)[];
      conceptName?: string;
      bloomLevel?: number;
    }
  | {
      source: 'adaptive';
      sessionId: string;
      exerciseId: string;
    };

interface SendMessageParams {
  historyKey: string | number;
  payload: StreamQuestionPayload;
  emptyQuestionErrorMessage?: string;
  requestErrorMessage?: string;
}

interface ChatSessionState {
  chatHistories: ChatHistories;
  userQuestion: string;
  loadingAI: boolean;
  aiError: string;
}

function toContextRequest(payload: StreamQuestionPayload): AskRinContextPayload {
  if (payload.source === 'adaptive') {
    return payload;
  }
  return {
    source: 'quiz',
    question: payload.question,
    options: payload.options,
    optionImages: payload.optionImages?.map((image) => image ?? null) ?? [],
    ...(payload.questionImage ? { questionImage: payload.questionImage } : {}),
    ...(payload.conceptName ? { conceptName: payload.conceptName } : {}),
    ...(payload.bloomLevel ? { bloomLevel: payload.bloomLevel } : {}),
  };
}

function toChatMessages(
  conversation: Awaited<ReturnType<typeof getAskRinConversation>>,
): ChatMessage[] {
  return (
    conversation?.messages.map((message) => ({
      id: message.messageId,
      role: message.role,
      content: message.content,
      timestamp: message.createdAt,
    })) ?? []
  );
}

function clearLegacyBrowserHistory(): void {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(LEGACY_HISTORY_PREFIX)) localStorage.removeItem(key);
  }
}

export function useAskRinChanSession() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const credentialsRef = useRef(new Map<string, AskRinContextCredentials>());
  const contextPromisesRef = useRef(new Map<string, Promise<AskRinContextCredentials>>());
  const hydrationPromisesRef = useRef(new Map<string, Promise<ChatMessage[]>>());
  const hydratedKeysRef = useRef(new Set<string>());
  const [state, setState] = useState<ChatSessionState>({
    chatHistories: {},
    userQuestion: '',
    loadingAI: false,
    aiError: '',
  });

  useEffect(() => {
    clearLegacyBrowserHistory();
    return () => abortControllerRef.current?.abort();
  }, []);

  const { aiError, chatHistories, loadingAI, userQuestion } = state;

  const setUserQuestion = (value: string) => {
    setState((prev) => ({ ...prev, userQuestion: value }));
  };

  const setAIError = (value: string) => {
    setState((prev) => ({ ...prev, aiError: value }));
  };

  const getCredentials = async (
    historyKey: string,
    payload: StreamQuestionPayload,
  ): Promise<AskRinContextCredentials> => {
    const cached = credentialsRef.current.get(historyKey);
    if (cached) return cached;

    const pending = contextPromisesRef.current.get(historyKey);
    if (pending) return pending;

    const promise = registerAskRinContext(toContextRequest(payload))
      .then((credentials) => {
        credentialsRef.current.set(historyKey, credentials);
        return credentials;
      })
      .finally(() => contextPromisesRef.current.delete(historyKey));
    contextPromisesRef.current.set(historyKey, promise);
    return promise;
  };

  const hydrateHistory = async (
    historyKey: string,
    credentials: AskRinContextCredentials,
    signal?: AbortSignal,
  ): Promise<ChatMessage[]> => {
    const pending = hydrationPromisesRef.current.get(historyKey);
    if (pending) return pending;
    const promise = getAskRinConversation(credentials.exerciseContextId, signal)
      .then((conversation) => {
        const messages = toChatMessages(conversation);
        hydratedKeysRef.current.add(historyKey);
        setState((prev) => ({
          ...prev,
          chatHistories: { ...prev.chatHistories, [historyKey]: messages },
        }));
        return messages;
      })
      .finally(() => hydrationPromisesRef.current.delete(historyKey));
    hydrationPromisesRef.current.set(historyKey, promise);
    return promise;
  };

  const ensureHistory = (historyKey: string | number, payload?: StreamQuestionPayload) => {
    const key = String(historyKey);
    if (!payload) {
      setState((prev) =>
        prev.chatHistories[key]
          ? prev
          : { ...prev, chatHistories: { ...prev.chatHistories, [key]: [] } },
      );
      return;
    }
    if (hydratedKeysRef.current.has(key)) return;
    void getCredentials(key, payload)
      .then((credentials) => hydrateHistory(key, credentials))
      .catch((error: unknown) => {
        setAIError(extractUnknownErrorMessage(error, 'Failed to load Rin-chan history.'));
      });
  };

  const clearHistory = async (historyKey: string | number) => {
    const key = String(historyKey);
    const credentials = credentialsRef.current.get(key);
    setState((prev) => ({
      ...prev,
      chatHistories: { ...prev.chatHistories, [key]: [] },
    }));
    if (!credentials) return;
    try {
      await deleteAskRinConversation(credentials.exerciseContextId);
      hydratedKeysRef.current.add(key);
    } catch (error: unknown) {
      setAIError(extractUnknownErrorMessage(error, 'Failed to clear Rin-chan history.'));
      await hydrateHistory(key, credentials).catch(() => undefined);
    }
  };

  const removeHistory = (historyKey: string | number) => {
    const key = String(historyKey);
    const credentials = credentialsRef.current.get(key);
    setState((prev) => {
      if (!prev.chatHistories[key]) return prev;
      const next = { ...prev.chatHistories };
      delete next[key];
      return { ...prev, chatHistories: next };
    });
    credentialsRef.current.delete(key);
    hydratedKeysRef.current.delete(key);
    if (credentials)
      void deleteAskRinConversation(credentials.exerciseContextId).catch(() => undefined);
  };

  const getHistory = (historyKey: string | number) =>
    chatHistories[String(historyKey)] ?? EMPTY_CHAT_MESSAGES;

  const cancelActiveStream = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setState((prev) => ({ ...prev, loadingAI: false }));
  };

  const sendMessage = async ({
    historyKey,
    payload,
    emptyQuestionErrorMessage,
    requestErrorMessage,
  }: SendMessageParams) => {
    const key = String(historyKey);
    const trimmedQuestion = userQuestion.trim();
    if (!trimmedQuestion) {
      setAIError(emptyQuestionErrorMessage || 'Please enter a question!');
      return false;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const ownsActiveStream = () => abortControllerRef.current === abortController;
    setState((prev) => ({ ...prev, loadingAI: true, aiError: '' }));

    let credentials: AskRinContextCredentials | null = null;
    try {
      credentials = await getCredentials(key, payload);
      if (!hydratedKeysRef.current.has(key)) {
        await hydrateHistory(key, credentials, abortController.signal);
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmedQuestion,
        timestamp: new Date().toISOString(),
      };
      const assistantPlaceholder: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        chatHistories: {
          ...prev.chatHistories,
          [key]: [...(prev.chatHistories[key] ?? []), userMessage, assistantPlaceholder],
        },
      }));

      const clientRequestId = crypto.randomUUID();
      const explanation = await streamAskRinChan(
        {
          exerciseContextToken: credentials.exerciseContextToken,
          message: trimmedQuestion,
          clientRequestId,
        },
        {
          signal: abortController.signal,
          onContent: (_, fullContent) => {
            if (!ownsActiveStream()) return;
            setState((prev) => ({
              ...prev,
              chatHistories: {
                ...prev.chatHistories,
                [key]: replaceLastAssistantMessage(prev.chatHistories[key] ?? [], fullContent),
              },
            }));
          },
        },
      );
      if (!ownsActiveStream()) return false;

      setState((prev) => ({
        ...prev,
        userQuestion: '',
        chatHistories: {
          ...prev.chatHistories,
          [key]: replaceLastAssistantMessage(prev.chatHistories[key] ?? [], explanation),
        },
      }));
      return true;
    } catch (error: unknown) {
      if (credentials) await hydrateHistory(key, credentials).catch(() => undefined);
      if (!isAbortLikeError(error) && ownsActiveStream()) {
        setAIError(
          extractUnknownErrorMessage(error, '') ||
            requestErrorMessage ||
            'Failed to connect to Rin-chan. Please try again.',
        );
      }
      return false;
    } finally {
      if (ownsActiveStream()) {
        abortControllerRef.current = null;
        setState((prev) => ({ ...prev, loadingAI: false }));
      }
    }
  };

  const totalTurns = Object.values(chatHistories).reduce(
    (sum, history) => sum + history.filter((message) => message.role === 'user').length,
    0,
  );

  return {
    chatHistories,
    userQuestion,
    setUserQuestion,
    loadingAI,
    aiError,
    setAIError,
    ensureHistory,
    clearHistory,
    removeHistory,
    getHistory,
    cancelActiveStream,
    sendMessage,
    totalTurns,
  };
}
