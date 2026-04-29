'use client';

import { useEffect, useMemo, useState } from 'react';
import { streamQuizAI } from '@/lib/quiz/ask-ai';

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

export function useStreamingChatSession(options: UseStreamingChatSessionOptions = {}) {
  const { persistenceKey } = options;
  const [chatHistories, setChatHistories] = useState<ChatHistories>({});
  const [userQuestion, setUserQuestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAIError] = useState('');

  useEffect(() => {
    if (!persistenceKey || typeof window === 'undefined') {
      return;
    }

    const savedChats = localStorage.getItem(persistenceKey);
    if (!savedChats) {
      setChatHistories({});
      return;
    }

    try {
      setChatHistories(JSON.parse(savedChats));
    } catch (error) {
      console.error('Failed to load chat histories:', error);
      setChatHistories({});
    }
  }, [persistenceKey]);

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
    setChatHistories((prev) => {
      if (prev[key]) {
        return prev;
      }
      return { ...prev, [key]: [] };
    });
  };

  const clearHistory = (historyKey: string | number) => {
    const key = String(historyKey);
    setChatHistories((prev) => ({ ...prev, [key]: [] }));
  };

  const removeHistory = (historyKey: string | number) => {
    const key = String(historyKey);
    setChatHistories((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
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

    setLoadingAI(true);
    setAIError('');

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

    setChatHistories((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), userMessage, assistantPlaceholder],
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
            setChatHistories((prev) => {
              const history = [...(prev[key] || [])];
              for (let i = history.length - 1; i >= 0; i -= 1) {
                if (history[i]?.role === 'assistant') {
                  history[i] = { ...history[i], content: fullContent };
                  break;
                }
              }
              return { ...prev, [key]: history };
            });
          },
        },
      );

      setChatHistories((prev) => {
        const history = [...(prev[key] || [])];
        for (let i = history.length - 1; i >= 0; i -= 1) {
          if (history[i]?.role === 'assistant') {
            history[i] = { ...history[i], content: explanation };
            break;
          }
        }
        return { ...prev, [key]: history };
      });

      setUserQuestion('');
      return true;
    } catch (error: any) {
      setChatHistories((prev) => {
        const history = [...(prev[key] || [])];
        const lastMessage = history[history.length - 1];
        if (lastMessage?.role === 'assistant' && !lastMessage.content.trim()) {
          history.pop();
        }
        return { ...prev, [key]: history };
      });
      setAIError(
        error.message ||
          requestErrorMessage ||
          'Failed to connect to AI service. Please try again.',
      );
      return false;
    } finally {
      setLoadingAI(false);
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
