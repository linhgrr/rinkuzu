'use client';

import { useEffect, useRef, useState } from 'react';
import { streamQuizAI } from '@/lib/quiz/ask-ai';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import {
  readChatHistories,
  writeChatHistories,
  type ChatHistoryPersistence,
} from '@/features/quiz/lib/chat-history-storage';
import { replaceLastAssistantMessage, type ChatMessage } from '@/features/quiz/lib/chat-history';

export type { ChatMessage } from '@/features/quiz/lib/chat-history';

type ChatHistories = Record<string, ChatMessage[]>;

const EMPTY_CHAT_MESSAGES: ChatMessage[] = [];
function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

interface StreamQuestionPayload {
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

interface SendMessageParams {
  historyKey: string | number;
  payload: StreamQuestionPayload;
  emptyQuestionErrorMessage?: string;
  requestErrorMessage?: string;
}

interface UseStreamingChatSessionOptions {
  persistence?: ChatHistoryPersistence;
}

interface ChatSessionState {
  chatHistories: ChatHistories;
  userQuestion: string;
  loadingAI: boolean;
  aiError: string;
}

function persistenceFromIdentity(identity: string | null): ChatHistoryPersistence | undefined {
  if (!identity) return undefined;
  if (identity.startsWith('attempt:')) {
    return { scope: 'attempt', id: identity.slice('attempt:'.length) };
  }
  if (identity === 'bookmarks:') {
    return { scope: 'bookmarks' };
  }
  return undefined;
}

export function useStreamingChatSession(options: UseStreamingChatSessionOptions = {}) {
  const { persistence } = options;
  const persistenceScope = persistence?.scope;
  const persistenceId = persistence?.scope === 'attempt' ? persistence.id : undefined;
  // Derive a stable identity string; rebuild persistence objects inside effects only.
  const persistenceIdentity =
    persistenceScope === 'attempt' && persistenceId
      ? `attempt:${persistenceId}`
      : persistenceScope === 'bookmarks'
        ? 'bookmarks:'
        : null;

  const [hydratedPersistenceIdentity, setHydratedPersistenceIdentity] = useState<string | null>(
    null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<ChatSessionState>({
    chatHistories: {},
    userQuestion: '',
    loadingAI: false,
    aiError: '',
  });

  useEffect(() => {
    const stablePersistence = persistenceFromIdentity(persistenceIdentity);
    if (!stablePersistence || typeof window === 'undefined') {
      return;
    }

    setState((prev) => ({
      ...prev,
      chatHistories: readChatHistories(stablePersistence),
    }));
    setHydratedPersistenceIdentity(persistenceIdentity);
  }, [persistenceIdentity]);

  const { aiError, chatHistories, loadingAI, userQuestion } = state;

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const setUserQuestion = (value: string) => {
    setState((prev) => ({ ...prev, userQuestion: value }));
  };

  const setAIError = (value: string) => {
    setState((prev) => ({ ...prev, aiError: value }));
  };

  useEffect(() => {
    const stablePersistence = persistenceFromIdentity(persistenceIdentity);
    if (
      !stablePersistence ||
      typeof window === 'undefined' ||
      hydratedPersistenceIdentity !== persistenceIdentity
    ) {
      return;
    }

    writeChatHistories(stablePersistence, chatHistories);
  }, [chatHistories, hydratedPersistenceIdentity, persistenceIdentity]);

  const ensureHistory = (historyKey: string | number) => {
    const key = String(historyKey);
    setState((prev) => {
      if (prev.chatHistories[key]) {
        return prev;
      }
      return {
        ...prev,
        chatHistories: { ...prev.chatHistories, [key]: [] },
      };
    });
  };

  const clearHistory = (historyKey: string | number) => {
    const key = String(historyKey);
    setState((prev) => ({
      ...prev,
      chatHistories: { ...prev.chatHistories, [key]: [] },
    }));
  };

  const removeHistory = (historyKey: string | number) => {
    const key = String(historyKey);
    setState((prev) => {
      if (!prev.chatHistories[key]) {
        return prev;
      }
      const next = { ...prev.chatHistories };
      delete next[key];
      return { ...prev, chatHistories: next };
    });
  };

  const getHistory = (historyKey: string | number) => {
    const key = String(historyKey);
    return chatHistories[key] ?? EMPTY_CHAT_MESSAGES;
  };

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

    setState((prev) => ({ ...prev, loadingAI: true, aiError: '' }));

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmedQuestion,
      timestamp: new Date().toISOString(),
    };

    const currentHistory = getHistory(key);
    const assistantPlaceholder: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      chatHistories: {
        ...prev.chatHistories,
        [key]: [
          ...(prev.chatHistories[key] ?? EMPTY_CHAT_MESSAGES),
          userMessage,
          assistantPlaceholder,
        ],
      },
    }));

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const ownsActiveStream = () => abortControllerRef.current === abortController;

    try {
      const explanation = await streamQuizAI(
        {
          question: payload.question,
          options: payload.options,
          userQuestion: trimmedQuestion,
          ...(payload.questionImage !== undefined ? { questionImage: payload.questionImage } : {}),
          ...(payload.optionImages !== undefined ? { optionImages: payload.optionImages } : {}),
          chatHistory: currentHistory,
        },
        {
          signal: abortController.signal,
          onContent: (_, fullContent) => {
            if (!ownsActiveStream()) {
              return;
            }
            setState((prev) => {
              const history = replaceLastAssistantMessage(
                prev.chatHistories[key] ?? EMPTY_CHAT_MESSAGES,
                fullContent,
              );
              return {
                ...prev,
                chatHistories: { ...prev.chatHistories, [key]: history },
              };
            });
          },
        },
      );

      if (!ownsActiveStream()) {
        return false;
      }

      setState((prev) => {
        const history = replaceLastAssistantMessage(
          prev.chatHistories[key] ?? EMPTY_CHAT_MESSAGES,
          explanation,
        );
        return {
          ...prev,
          chatHistories: { ...prev.chatHistories, [key]: history },
          userQuestion: '',
        };
      });
      return true;
    } catch (error: unknown) {
      const isOwner = ownsActiveStream();
      setState((prev) => {
        const history = [...(prev.chatHistories[key] ?? EMPTY_CHAT_MESSAGES)];
        // Only remove this request's empty assistant — never the newer stream's placeholder.
        // Identity match: onContent/success replace the message object, so a still-empty
        // placeholder remains the same reference we appended for this request.
        const ownedEmptyIdx = history.findIndex(
          (message) => message === assistantPlaceholder && !message.content.trim(),
        );
        if (ownedEmptyIdx >= 0) {
          history.splice(ownedEmptyIdx, 1);
        }

        if (isAbortLikeError(error)) {
          return {
            ...prev,
            aiError: '',
            chatHistories: { ...prev.chatHistories, [key]: history },
          };
        }

        if (!isOwner) {
          // Superseded/cancelled request: keep the active stream's error/loading untouched.
          return {
            ...prev,
            chatHistories: { ...prev.chatHistories, [key]: history },
          };
        }

        return {
          ...prev,
          aiError:
            extractUnknownErrorMessage(error, '') ||
            requestErrorMessage ||
            'Failed to connect to AI service. Please try again.',
          chatHistories: { ...prev.chatHistories, [key]: history },
        };
      });
      return false;
    } finally {
      if (ownsActiveStream()) {
        abortControllerRef.current = null;
        setState((prev) => ({ ...prev, loadingAI: false }));
      }
    }
  };

  const totalTurns = Object.values(chatHistories).reduce(
    (sum, history) => sum + Math.floor(history.length / 2),
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
