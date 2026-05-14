'use client';

import { useEffect, useMemo, useState } from 'react';
import { streamQuizAI } from '@/lib/quiz/ask-ai';
import { extractUnknownErrorMessage } from '@/lib/api/error';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

type ChatHistories = Record<string, ChatMessage[]>;

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
  persistenceKey?: string;
}

interface ChatSessionState {
  chatHistories: ChatHistories;
  userQuestion: string;
  loadingAI: boolean;
  aiError: string;
}

export function useStreamingChatSession(options: UseStreamingChatSessionOptions = {}) {
  const { persistenceKey } = options;
  const [state, setState] = useState<ChatSessionState>({
    chatHistories: {},
    userQuestion: '',
    loadingAI: false,
    aiError: '',
  });

  useEffect(() => {
    if (!persistenceKey || typeof window === 'undefined') {
      return;
    }

    let chatHistories: ChatHistories = {};
    const savedChats = localStorage.getItem(persistenceKey);

    if (savedChats) {
      try {
        chatHistories = JSON.parse(savedChats);
      } catch (error) {
        console.error('Failed to load chat histories:', error);
      }
    }

    setState((prev) => ({ ...prev, chatHistories }));
  }, [persistenceKey]);

  const { aiError, chatHistories, loadingAI, userQuestion } = state;

  const setUserQuestion = (value: string) => {
    setState((prev) => ({ ...prev, userQuestion: value }));
  };

  const setAIError = (value: string) => {
    setState((prev) => ({ ...prev, aiError: value }));
  };

  useEffect(() => {
    if (!persistenceKey || typeof window === 'undefined') {
      return;
    }

    if (Object.keys(chatHistories).length > 0) {
      localStorage.setItem(persistenceKey, JSON.stringify(chatHistories));
    } else {
      localStorage.removeItem(persistenceKey);
    }
  }, [chatHistories, persistenceKey]);

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
    return chatHistories[key] || [];
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
        [key]: [...(prev.chatHistories[key] || []), userMessage, assistantPlaceholder],
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
              const history = [...(prev.chatHistories[key] || [])];
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
        const history = [...(prev.chatHistories[key] || [])];
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
        const history = [...(prev.chatHistories[key] || [])];
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
