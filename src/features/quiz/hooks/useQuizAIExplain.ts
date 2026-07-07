'use client';

import { useState } from 'react';
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

export function useQuizAIExplain() {
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiExplanation, setAIExplanation] = useState('');
  const [userQuestion, setUserQuestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAIError] = useState('');
  const { promptUpgrade } = useUpgradePrompt();

  const askAI = async (currentQuestion: ExplainableQuestion) => {
    setLoadingAI(true);
    setAIError('');
    setAIExplanation('');

    try {
      const explanation = await streamQuizAI(
        {
          question: currentQuestion.question,
          options: currentQuestion.options,
          userQuestion: userQuestion.trim() || undefined,
          questionImage: currentQuestion.questionImage,
          optionImages: currentQuestion.optionImages,
        },
        {
          onContent: (_, fullContent) => {
            setAIExplanation(fullContent);
          },
        },
      );

      setAIExplanation(explanation);
    } catch (error: unknown) {
      if (isPremiumLimitError(error)) {
        promptUpgrade('rate_limit');
      }
      setAIError(extractUnknownErrorMessage(error, 'Failed to connect to AI service'));
    } finally {
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
