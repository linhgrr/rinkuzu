'use client';

import { useEffect, useRef, useState } from 'react';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { useUpgradePrompt } from '@/features/subscription/components/UpgradePromptProvider';
import { isPremiumLimitError } from '@/features/subscription/lib/limit-error';

interface ExplainableQuestion {
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function useQuizAIExplain() {
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiExplanation, setAIExplanation] = useState('');
  const [userQuestion, setUserQuestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAIError] = useState('');
  const { promptUpgrade } = useUpgradePrompt();
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      const activeController = abortControllerRef.current;
      abortControllerRef.current = null;
      activeController?.abort();
    },
    [],
  );

  const askAI = async (currentQuestion: ExplainableQuestion) => {
    setLoadingAI(true);
    setAIError('');
    setAIExplanation('');
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const { streamQuizAI } = await import('@/lib/quiz/ask-ai');
      const explanation = await streamQuizAI(
        {
          question: currentQuestion.question,
          options: currentQuestion.options,
          ...(userQuestion.trim() ? { userQuestion: userQuestion.trim() } : {}),
          ...(currentQuestion.questionImage !== undefined
            ? { questionImage: currentQuestion.questionImage }
            : {}),
          ...(currentQuestion.optionImages !== undefined
            ? { optionImages: currentQuestion.optionImages }
            : {}),
        },
        {
          signal: abortController.signal,
          onContent: (_, fullContent) => {
            if (abortControllerRef.current === abortController) {
              setAIExplanation(fullContent);
            }
          },
        },
      );

      if (abortControllerRef.current !== abortController) return;
      setAIExplanation(explanation);
      abortControllerRef.current = null;
      setLoadingAI(false);
    } catch (error: unknown) {
      if (isAbortLikeError(error)) {
        if (abortControllerRef.current === abortController) {
          setAIError('');
          abortControllerRef.current = null;
          setLoadingAI(false);
        }
        return;
      }
      if (abortControllerRef.current !== abortController) return;
      if (isPremiumLimitError(error)) {
        promptUpgrade('rate_limit');
      }
      setAIError(extractUnknownErrorMessage(error, 'Failed to connect to AI service'));
      abortControllerRef.current = null;
      setLoadingAI(false);
    }
  };

  const openAIModal = () => {
    setShowAIModal(true);
    setUserQuestion('');
    setAIExplanation('');
    setAIError('');
  };

  const closeAIModal = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoadingAI(false);
    setShowAIModal(false);
  };

  return {
    showAIModal,
    aiExplanation,
    userQuestion,
    setUserQuestion,
    loadingAI,
    aiError,
    askAI,
    openAIModal,
    closeAIModal,
  };
}
