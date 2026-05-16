// /src/hooks/usePdfProcessor.ts
import { useCallback, useEffect, useRef } from 'react';
import pLimit from 'p-limit';
import { toast } from 'sonner';
import { ApiResponseError, fetchApiData, fetchApiResponse } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { useDraftStore } from '@/store/useDraftStore';

interface ChunkInfo {
  index: number;
  startPage: number;
  endPage: number;
  status: string;
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const MAX_CONCURRENT_CHUNKS = 3;
const MAX_ERRORS_BEFORE_ABORT = 3;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES,
): Promise<{
  questions: any[];
  progress?: {
    isComplete?: boolean;
    totalQuestions?: number;
  };
}> {
  const attemptFetch = async (
    attempt: number,
    lastError: Error | null,
  ): Promise<{
    questions: any[];
    progress?: {
      isComplete?: boolean;
      totalQuestions?: number;
    };
  }> => {
    if (attempt >= retries) {
      throw lastError || new Error('All retries failed');
    }

    try {
      const response = await fetchApiResponse<{
        questions: any[];
        progress?: {
          isComplete?: boolean;
          totalQuestions?: number;
        };
      }>(url, options);
      return response.data;
    } catch (error: unknown) {
      if (error instanceof ApiResponseError && error.status === 409) {
        const payload =
          error.meta && typeof error.meta === 'object'
            ? (error.meta as { retryAfter?: unknown })
            : null;
        const retryAfter =
          typeof payload?.retryAfter === 'number'
            ? payload.retryAfter
            : INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, retryAfter));
        return attemptFetch(attempt + 1, lastError);
      }

      const nextError =
        error instanceof Error
          ? error
          : new Error(extractUnknownErrorMessage(error, 'Network request failed'));

      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return attemptFetch(attempt + 1, nextError);
    }
  };

  return attemptFetch(0, null);
}

export function usePdfProcessor() {
  const { updateDraftProgress, completeDraft, setDraftError } = useDraftStore();
  const processingRef = useRef<Record<string, boolean>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach((controller) => {
        controller.abort();
      });
      processingRef.current = {};
      abortControllersRef.current = {};
    };
  }, []);

  const processChunk = useCallback(
    async (
      draftId: string,
      chunkIndex: number,
      signal?: AbortSignal,
    ): Promise<{
      success: boolean;
      questions: any[];
      isComplete: boolean;
      totalQuestions: number;
    }> => {
      const payload = await fetchWithRetry(`/api/draft/${draftId}/process-chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkIndex }),
        signal,
      });
      return {
        success: true,
        questions: payload.questions || [],
        isComplete: payload.progress?.isComplete || false,
        totalQuestions: payload.progress?.totalQuestions || 0,
      };
    },
    [],
  );

  const startProcessing = useCallback(
    async (draftId: string, chunks: ChunkInfo[], title: string) => {
      if (processingRef.current[draftId]) {
        console.warn(`Draft ${draftId} is already being processed`);
        return;
      }

      processingRef.current[draftId] = true;
      const abortController = new AbortController();
      abortControllersRef.current[draftId] = abortController;

      const pendingChunks = chunks
        .filter(
          (chunk) =>
            chunk.status === 'pending' || chunk.status === 'error' || chunk.status === 'processing',
        )
        .sort((left, right) => left.index - right.index);

      let processedCount = chunks.filter((chunk) => chunk.status === 'done').length;
      let totalQuestions = 0;
      let totalErrors = 0;
      let hasCompleted = false;
      let hasAbortedForErrors = false;
      const limit = pLimit(MAX_CONCURRENT_CHUNKS);

      try {
        await Promise.all(
          pendingChunks.map((chunk) =>
            limit(async () => {
              if (abortController.signal.aborted || hasCompleted || hasAbortedForErrors) {
                return;
              }

              try {
                const result = await processChunk(draftId, chunk.index, abortController.signal);

                if (!result.success) {
                  return;
                }

                processedCount++;
                totalQuestions = result.totalQuestions;

                updateDraftProgress(draftId, {
                  chunksProcessed: processedCount,
                  questionsCount: totalQuestions,
                  status: 'processing',
                });

                if (result.isComplete) {
                  hasCompleted = true;
                  completeDraft(draftId, totalQuestions);
                  toast.success(`"${title}" đã sẵn sàng!`, {
                    description: `${totalQuestions} câu hỏi được trích xuất`,
                    action: {
                      label: 'Xem',
                      onClick: () => (window.location.href = `/draft/${draftId}/edit`),
                    },
                  });
                  abortController.abort();
                }
              } catch (chunkError: unknown) {
                if (chunkError instanceof Error && chunkError.name === 'AbortError') {
                  return;
                }

                totalErrors++;
                console.error(`Chunk ${chunk.index} failed:`, chunkError);

                if (totalErrors >= MAX_ERRORS_BEFORE_ABORT) {
                  hasAbortedForErrors = true;
                  setDraftError(
                    draftId,
                    `Quá nhiều lỗi khi xử lý chunk: ${extractUnknownErrorMessage(chunkError, 'Unknown chunk error')}`,
                  );
                  toast.error(`Lỗi xử lý "${title}"`, {
                    description: 'Vui lòng thử lại sau',
                  });
                  abortController.abort();
                }
              }
            }),
          ),
        );
      } catch (error: unknown) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          const message = extractUnknownErrorMessage(error, 'Failed to process PDF draft');
          setDraftError(draftId, message);
          toast.error(`Lỗi xử lý "${title}"`, {
            description: message,
          });
        }
      } finally {
        delete processingRef.current[draftId];
        delete abortControllersRef.current[draftId];
      }
    },
    [completeDraft, processChunk, setDraftError, updateDraftProgress],
  );

  const stopProcessing = useCallback((draftId: string) => {
    const controller = abortControllersRef.current[draftId];
    if (controller) {
      controller.abort();
      delete abortControllersRef.current[draftId];
    }
    delete processingRef.current[draftId];
  }, []);

  const resumeProcessing = useCallback(
    async (draftId: string) => {
      try {
        const { draft } = await fetchApiData<{ draft: any }>(`/api/draft/${draftId}`);

        if (draft.status === 'completed') {
          return;
        }

        await startProcessing(draftId, draft.chunks.chunkDetails, draft.title);
      } catch (error) {
        console.error('Resume processing error:', error);
      }
    },
    [startProcessing],
  );

  return {
    startProcessing,
    stopProcessing,
    resumeProcessing,
  };
}
