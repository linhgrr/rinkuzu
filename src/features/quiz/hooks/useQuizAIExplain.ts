'use client';

import { useEffect, useRef, useState } from 'react';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { streamQuizAI } from '@/lib/quiz/ask-ai';
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
      abortControllerRef.current?.abort();
    },
    [],
  );

  const askAI = async (currentQuestion: ExplainableQuestion) => {
    setLoadingAI(true);
    setAIError('');
    setAIExplanation('');

    try {
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const explanation = await streamQuizAI(
        {
          question: currentQuestion.question,
          options: currentQuestion.options,
          userQuestion: userQuestion.trim() || undefined,
          questionImage: currentQuestion.questionImage,
          optionImages: currentQuestion.optionImages,
        },
        {
          signal: abortController.signal,
          onContent: (_, fullContent) => {
            setAIExplanation(fullContent);
          },
        },
      );

      setAIExplanation(explanation);
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    } catch (error: unknown) {
      if (isAbortLikeError(error)) {
        setAIError('');
        return;
      }
      if (isPremiumLimitError(error)) {
        promptUpgrade('rate_limit');
      }
      setAIError(extractUnknownErrorMessage(error, 'Failed to connect to AI service'));
    } finally {
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
