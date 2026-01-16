import { useState, useCallback, useRef } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UseStreamingAIOptions {
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: string[];
  chatHistory?: ChatMessage[];
}

interface UseStreamingAIReturn {
  // State
  content: string;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  startStreaming: (userQuestion?: string) => Promise<void>;
  stopStreaming: () => void;
  reset: () => void;
}

/**
 * Hook to consume SSE streaming response from ask-ai API
 *
 * @example
 * ```tsx
 * const { content, isStreaming, startStreaming, stopStreaming } = useStreamingAI({
 *   question: 'What is React?',
 *   options: ['A library', 'A framework', 'A language', 'An OS'],
 * });
 *
 * // Start streaming
 * await startStreaming('Explain this question');
 *
 * // Display content as it streams
 * <div>{content}</div>
 * ```
 */
export function useStreamingAI(options: UseStreamingAIOptions): UseStreamingAIReturn {
  const { question, options: quizOptions, questionImage, optionImages, chatHistory = [] } = options;

  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    stopStreaming();
    setContent('');
    setError(null);
  }, [stopStreaming]);

  const startStreaming = useCallback(async (userQuestion?: string) => {
    // Reset state
    setContent('');
    setError(null);
    setIsLoading(true);
    setIsStreaming(false);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/quiz/ask-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          options: quizOptions,
          userQuestion,
          questionImage,
          optionImages,
          chatHistory,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      // Check if response is streaming
      const contentType = response.headers.get('Content-Type');
      if (!contentType?.includes('text/event-stream')) {
        // Fallback to non-streaming response
        const data = await response.json();
        if (data.success) {
          setContent(data.data.explanation);
        } else {
          throw new Error(data.error || 'Failed to get response');
        }
        setIsLoading(false);
        return;
      }

      // Handle streaming response
      if (!response.body) {
        throw new Error('Response body is null');
      }

      setIsLoading(false);
      setIsStreaming(true);

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete message in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6); // Remove 'data: ' prefix
              const data = JSON.parse(jsonStr);

              if (data.done) {
                // Stream finished
                setIsStreaming(false);
                break;
              } else if (data.error) {
                throw new Error(data.error);
              } else if (data.content) {
                // Append content
                setContent(prev => prev + data.content);
              }
            } catch (parseError) {
              // Ignore JSON parse errors for incomplete data
              console.warn('Failed to parse SSE data:', line);
            }
          }
        }
      }

      setIsStreaming(false);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was cancelled
        console.log('Streaming cancelled');
      } else {
        console.error('Streaming error:', err);
        setError(err.message || 'Failed to stream response');
      }
      setIsStreaming(false);
      setIsLoading(false);
    } finally {
      abortControllerRef.current = null;
      readerRef.current = null;
    }
  }, [question, quizOptions, questionImage, optionImages, chatHistory]);

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

/**
 * Simpler hook for one-off streaming requests
 *
 * @example
 * ```tsx
 * const { streamAI, content, isStreaming } = useAIStream();
 *
 * const handleAsk = async () => {
 *   await streamAI({
 *     question: 'What is React?',
 *     options: ['A', 'B', 'C', 'D'],
 *     userQuestion: 'Explain this',
 *   });
 * };
 * ```
 */
export function useAIStream() {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    stopStreaming();
    setContent('');
    setError(null);
  }, [stopStreaming]);

  const streamAI = useCallback(async (params: {
    question: string;
    options: string[];
    userQuestion?: string;
    questionImage?: string;
    optionImages?: string[];
    chatHistory?: ChatMessage[];
  }) => {
    setContent('');
    setError(null);
    setIsLoading(true);
    setIsStreaming(false);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/quiz/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, stream: true }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type');
      if (!contentType?.includes('text/event-stream')) {
        const data = await response.json();
        if (data.success) {
          setContent(data.data.explanation);
        } else {
          throw new Error(data.error || 'Failed to get response');
        }
        setIsLoading(false);
        return data.data.explanation;
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      setIsLoading(false);
      setIsStreaming(true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                setIsStreaming(false);
                return fullContent;
              } else if (data.error) {
                throw new Error(data.error);
              } else if (data.content) {
                fullContent += data.content;
                setContent(fullContent);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      setIsStreaming(false);
      return fullContent;

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to stream response');
      }
      setIsStreaming(false);
      setIsLoading(false);
      throw err;
    } finally {
      abortControllerRef.current = null;
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
