// /src/hooks/usePdfProcessor.ts
import { useCallback, useRef, useEffect } from 'react';
import { useDraftStore } from '@/store/useDraftStore';
import { toast } from 'sonner';

interface ChunkInfo {
  index: number;
  startPage: number;
  endPage: number;
  status: string;
}

export function usePdfProcessor() {
  const { updateDraftProgress, completeDraft, setDraftError } = useDraftStore();
  const processingRef = useRef<Record<string, boolean>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach(controller => {
        controller.abort();
      });
    };
  }, []);

  const processChunk = useCallback(async (
    draftId: string,
    chunkIndex: number,
    signal?: AbortSignal
  ): Promise<{ success: boolean; questions: any[]; isComplete: boolean; totalQuestions: number }> => {
    const response = await fetch(`/api/draft/${draftId}/process-chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunkIndex }),
      signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process chunk');
    }

    const result = await response.json();
    return {
      success: result.success,
      questions: result.questions || [],
      isComplete: result.progress?.isComplete || false,
      totalQuestions: result.progress?.totalQuestions || 0,
    };
  }, []);

  const startProcessing = useCallback(async (
    draftId: string,
    chunks: ChunkInfo[],
    title: string
  ) => {
    if (processingRef.current[draftId]) {
      console.log(`Draft ${draftId} is already being processed`);
      return;
    }

    processingRef.current[draftId] = true;
    const abortController = new AbortController();
    abortControllersRef.current[draftId] = abortController;

    const pendingChunks = chunks
      .filter(c => c.status === 'pending' || c.status === 'error')
      .sort((a, b) => a.index - b.index);

    let processedCount = chunks.filter(c => c.status === 'done').length;
    let totalQuestions = 0;

    try {
      for (const chunk of pendingChunks) {
        if (abortController.signal.aborted) {
          break;
        }

        try {
          const result = await processChunk(
            draftId,
            chunk.index,
            abortController.signal
          );

          processedCount++;
          totalQuestions = result.totalQuestions;

          updateDraftProgress(draftId, {
            chunksProcessed: processedCount,
            questionsCount: totalQuestions,
            status: 'processing',
          });

          if (result.isComplete) {
            completeDraft(draftId, totalQuestions);
            toast.success(`"${title}" đã sẵn sàng!`, {
              description: `${totalQuestions} câu hỏi được trích xuất`,
              action: {
                label: 'Xem',
                onClick: () => window.location.href = `/draft/${draftId}/edit`,
              },
            });
            break;
          }

          // Small delay between chunks
          await new Promise(r => setTimeout(r, 300));

        } catch (chunkError: any) {
          if (chunkError.name === 'AbortError') {
            break;
          }
          console.error(`Chunk ${chunk.index} failed:`, chunkError);
          // Continue with next chunk on error
        }
      }
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
  }, [processChunk, updateDraftProgress, completeDraft, setDraftError]);

  const stopProcessing = useCallback((draftId: string) => {
    const controller = abortControllersRef.current[draftId];
    if (controller) {
      controller.abort();
    }
  }, []);

  const resumeProcessing = useCallback(async (draftId: string) => {
    try {
      const response = await fetch(`/api/draft/${draftId}`);
      if (!response.ok) throw new Error('Failed to fetch draft');

      const { draft } = await response.json();

      if (draft.status === 'completed') {
        return; // Already done
      }

      await startProcessing(
        draftId,
        draft.chunks.chunkDetails,
        draft.title
      );
    } catch (error) {
      console.error('Resume processing error:', error);
    }
  }, [startProcessing]);

  return {
    startProcessing,
    stopProcessing,
    resumeProcessing,
  };
}
