import { useCallback, useRef, useState } from 'react';
import {
  streamQuizAI,
  type QuizAiChatMessage,
  type QuizAskAiRequest,
} from '@/lib/quiz/ask-ai';

interface UseStreamingAIOptions {
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
  chatHistory?: QuizAiChatMessage[];
}

interface UseStreamingAIReturn {
  content: string;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  startStreaming: (userQuestion?: string) => Promise<void>;
  stopStreaming: () => void;
  reset: () => void;
}

export function useStreamingAI(options: UseStreamingAIOptions): UseStreamingAIReturn {
  const { question, options: quizOptions, questionImage, optionImages, chatHistory = [] } = options;
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    stopStreaming();
    setContent('');
    setError(null);
  }, [stopStreaming]);

  const startStreaming = useCallback(async (userQuestion?: string) => {
    setContent('');
    setError(null);
    setIsLoading(true);
    setIsStreaming(false);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setIsStreaming(true);
      const finalContent = await streamQuizAI(
        {
          question,
          options: quizOptions,
          userQuestion,
          questionImage,
          optionImages,
          chatHistory,
        },
        {
          signal: abortController.signal,
          onContent: (_, fullContent) => {
            setContent(fullContent);
          },
        }
      );

      setContent(finalContent);
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Streaming error:', error);
        setError(error?.message || 'Failed to stream response');
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
      setIsLoading(false);
    }
  }, [chatHistory, optionImages, question, questionImage, quizOptions]);

  return {
    content,
    isStreaming,
    isLoading,
    error,
    startStreaming,
    stopStreaming,
    reset,
  };
}

export function useAIStream() {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    stopStreaming();
    setContent('');
    setError(null);
  }, [stopStreaming]);

  const streamAI = useCallback(async (params: QuizAskAiRequest) => {
    setContent('');
    setError(null);
    setIsLoading(true);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const finalContent = await streamQuizAI(params, {
        signal: abortController.signal,
        onContent: (_, fullContent) => {
          setContent(fullContent);
        },
      });

      setContent(finalContent);
      return finalContent;
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        setError(error?.message || 'Failed to stream response');
      }
      throw error;
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
      setIsLoading(false);
    }
  }, []);

  return {
    content,
    isStreaming,
    isLoading,
    error,
    streamAI,
    stopStreaming,
    reset,
  };
}

export default useStreamingAI;
