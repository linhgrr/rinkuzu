// /src/hooks/usePdfProcessor.ts
import { useCallback, useRef, useEffect } from 'react';
import { useDraftStore } from '@/store/useDraftStore';
import { toast } from 'sonner';
import { mapWithConcurrency } from '@/lib/asyncPool';
import { extractApiErrorMessage } from '@/lib/api/error';

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
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // If conflict (another request processing), wait and retry
      if (response.status === 409) {
        const data = await response.json().catch(() => null);
        const retryAfter = data.retryAfter || INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, retryAfter));
        continue;
      }

      return response;
    } catch (error: any) {
      lastError = error;

      // Don't retry on abort
      if (error.name === 'AbortError') {
        throw error;
      }

      // Exponential backoff
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError || new Error('All retries failed');
}

export function usePdfProcessor() {
  const { updateDraftProgress, completeDraft, setDraftError } = useDraftStore();
  const processingRef = useRef<Record<string, boolean>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach((controller) => {
        controller.abort();
      });
      // Clear refs completely
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
      const response = await fetchWithRetry(`/api/draft/${draftId}/process-chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkIndex }),
        signal,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(extractApiErrorMessage(errorPayload, 'Failed to process chunk'));
      }

      const result = await response.json();
      return {
        success: result.success !== false,
        questions: result.questions || [],
        isComplete: result.progress?.isComplete || false,
        totalQuestions: result.progress?.totalQuestions || 0,
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

      // Also retry 'processing' chunks (might be stale locks)
      const pendingChunks = chunks
        .filter((c) => c.status === 'pending' || c.status === 'error' || c.status === 'processing')
        .sort((a, b) => a.index - b.index);

      let processedCount = chunks.filter((c) => c.status === 'done').length;
      let totalQuestions = 0;
      let totalErrors = 0;
      let hasCompleted = false;
      let hasAbortedForErrors = false;

      try {
        await mapWithConcurrency(pendingChunks, MAX_CONCURRENT_CHUNKS, async (chunk) => {
          if (abortController.signal.aborted || hasCompleted || hasAbortedForErrors) {
            return;
          }

          try {
            const result = await processChunk(draftId, chunk.index, abortController.signal);

            if (result.success) {
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
                return;
              }
            }
          } catch (chunkError: any) {
            if (chunkError.name === 'AbortError') {
              return;
            }

            totalErrors++;
            console.error(`Chunk ${chunk.index} failed:`, chunkError);

            // Stop if too many failures overall
            if (totalErrors >= MAX_ERRORS_BEFORE_ABORT) {
              hasAbortedForErrors = true;
              setDraftError(draftId, `Quá nhiều lỗi khi xử lý chunk: ${chunkError.message}`);
              toast.error(`Lỗi xử lý "${title}"`, {
                description: 'Vui lòng thử lại sau',
              });
              abortController.abort();
            }
          }
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          setDraftError(draftId, error.message);
          toast.error(`Lỗi xử lý "${title}"`, {
            description: error.message,
          });
        }
      } finally {
        delete processingRef.current[draftId];
        delete abortControllersRef.current[draftId];
      }
    },
    [processChunk, updateDraftProgress, completeDraft, setDraftError],
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
        const response = await fetch(`/api/draft/${draftId}`);
        if (!response.ok) throw new Error('Failed to fetch draft');

        const { draft } = await response.json();

        if (draft.status === 'completed') {
          return; // Already done
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
