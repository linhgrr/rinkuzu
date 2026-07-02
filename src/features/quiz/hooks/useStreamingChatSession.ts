'use client';

import { useEffect, useMemo, useState } from 'react';
import { streamQuizAI } from '@/lib/quiz/ask-ai';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import {
  readChatHistories,
  writeChatHistories,
  type ChatHistoryPersistence,
} from '@/features/quiz/lib/chat-history-storage';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

type ChatHistories = Record<string, ChatMessage[]>;

const EMPTY_CHAT_MESSAGES: ChatMessage[] = [];

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

export function useStreamingChatSession(options: UseStreamingChatSessionOptions = {}) {
  const { persistence } = options;
  const persistenceScope = persistence?.scope;
  const persistenceId = persistence?.scope === 'attempt' ? persistence.id : undefined;
  const stablePersistence = useMemo<ChatHistoryPersistence | undefined>(() => {
    if (persistenceScope === 'attempt' && persistenceId) {
      return { scope: 'attempt', id: persistenceId };
    }
    return persistenceScope === 'bookmarks' ? { scope: 'bookmarks' } : undefined;
  }, [persistenceId, persistenceScope]);
  const persistenceIdentity = stablePersistence
    ? `${stablePersistence.scope}:${stablePersistence.scope === 'attempt' ? stablePersistence.id : ''}`
    : null;
  const [hydratedPersistenceIdentity, setHydratedPersistenceIdentity] = useState<string | null>(
    null,
  );
  const [state, setState] = useState<ChatSessionState>({
    chatHistories: {},
    userQuestion: '',
    loadingAI: false,
    aiError: '',
  });

  useEffect(() => {
    if (!stablePersistence || typeof window === 'undefined') {
      return;
    }

    setState((prev) => ({
      ...prev,
      chatHistories: readChatHistories(stablePersistence),
    }));
    setHydratedPersistenceIdentity(persistenceIdentity);
  }, [persistenceIdentity, stablePersistence]);

  const { aiError, chatHistories, loadingAI, userQuestion } = state;

  const setUserQuestion = (value: string) => {
    setState((prev) => ({ ...prev, userQuestion: value }));
  };

  const setAIError = (value: string) => {
    setState((prev) => ({ ...prev, aiError: value }));
  };

  useEffect(() => {
    if (
      !stablePersistence ||
      typeof window === 'undefined' ||
      hydratedPersistenceIdentity !== persistenceIdentity
    ) {
      return;
    }

    writeChatHistories(stablePersistence, chatHistories);
  }, [chatHistories, hydratedPersistenceIdentity, persistenceIdentity, stablePersistence]);

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
    const nextHistory = [...currentHistory, userMessage];
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

    try {
      const explanation = await streamQuizAI(
        {
          question: payload.question,
          options: payload.options,
          userQuestion: trimmedQuestion,
          questionImage: payload.questionImage,
          optionImages: payload.optionImages,
          chatHistory: nextHistory,
        },
        {
          onContent: (_, fullContent) => {
            setState((prev) => {
              const history = [...(prev.chatHistories[key] ?? EMPTY_CHAT_MESSAGES)];
              for (let i = history.length - 1; i >= 0; i -= 1) {
                if (history[i]?.role === 'assistant') {
                  history[i] = { ...history[i], content: fullContent };
                  break;
                }
              }
              return {
                ...prev,
                chatHistories: { ...prev.chatHistories, [key]: history },
              };
            });
          },
        },
      );

      setState((prev) => {
        const history = [...(prev.chatHistories[key] ?? EMPTY_CHAT_MESSAGES)];
        for (let i = history.length - 1; i >= 0; i -= 1) {
          if (history[i]?.role === 'assistant') {
            history[i] = { ...history[i], content: explanation };
            break;
          }
        }
        return {
          ...prev,
          chatHistories: { ...prev.chatHistories, [key]: history },
          userQuestion: '',
        };
      });
      return true;
    } catch (error: unknown) {
      setState((prev) => {
        const history = [...(prev.chatHistories[key] ?? EMPTY_CHAT_MESSAGES)];
        const lastMessage = history[history.length - 1];
        if (lastMessage?.role === 'assistant' && !lastMessage.content.trim()) {
          history.pop();
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
      setState((prev) => ({ ...prev, loadingAI: false }));
    }
  };

  const totalTurns = useMemo(
    () =>
      Object.values(chatHistories).reduce(
        (sum, history) => sum + Math.floor(history.length / 2),
        0,
      ),
    [chatHistories],
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
    sendMessage,
    totalTurns,
  };
}
