//
// The FastAPI service owns quiz drafts and runs OCR + a single LLM extraction
// call in a background task. This hook polls /api/quiz-drafts/{id} (a thin Next
// proxy to FastAPI) until the draft reaches a terminal status.
//
// Public surface (`startProcessing`, `stopProcessing`, `resumeProcessing`)
// is preserved so existing consumers (DraftSyncProvider, create page,
// FloatingDraftProgress) keep working without changes.

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { getQuizDraft } from '@/lib/quiz/draftApi';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import { mapDraftStatus } from '@/lib/quiz/draftStatus';
import { toBrowserPath } from '@/lib/routing/pathname';
import { useDraftStore } from '@/store/useDraftStore';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 200; // ~10 minutes hard cap

// Codes for provider-wide outages, where the same PDF will likely work again in
// a few minutes. Anything else keeps the generic "try again later" text.
const RETRYABLE_DRAFT_ERROR_CODES = new Set(['ocr_request_failed']);

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function pollOnce(draftId: string, signal: AbortSignal): Promise<QuizDraft | null> {
  try {
    return await getQuizDraft(draftId, { signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null;
    // Treat 404 / network as "stop polling, mark error".
    throw error;
  }
}

export function usePdfProcessor() {
  const locale = useLocale();
  const t = useTranslations('draft');
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

  const startProcessing = async (draftId: string, title: string) => {
    if (processingRef.current[draftId]) {
      console.warn(`Draft ${draftId} is already being processed`);
      return;
    }

    processingRef.current[draftId] = true;
    const abortController = new AbortController();
    abortControllersRef.current[draftId] = abortController;
    const cleanupProcessing = () => {
      delete processingRef.current[draftId];
      delete abortControllersRef.current[draftId];
    };

    try {
      for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
        if (abortController.signal.aborted) {
          cleanupProcessing();
          return;
        }

        let snapshot: QuizDraft | null;
        try {
          snapshot = await pollOnce(draftId, abortController.signal);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            cleanupProcessing();
            return;
          }
          const message = extractUnknownErrorMessage(error, t('statusFetchFailed'));
          setDraftError(draftId, message);
          toast.error(t('failedTitle', { title }), { description: message });
          cleanupProcessing();
          return;
        }

        if (!snapshot) {
          cleanupProcessing();
          return;
        }

        const mapped = mapDraftStatus(snapshot.status);

        if (mapped === 'completed') {
          const totalQuestions = snapshot.questions.length;
          completeDraft(draftId, totalQuestions);
          toast.success(t('readyTitle', { title }), {
            description: t('readyDescription', { count: totalQuestions }),
            action: {
              label: t('view'),
              onClick: () => {
                window.location.href = toBrowserPath(`/draft/${draftId}/edit`, locale);
              },
            },
          });
          cleanupProcessing();
          return;
        }

        // `submitted` (null) and the error statuses both stop polling; only
        // the error set surfaces a failure toast.
        if (mapped === 'error') {
          const retryable =
            snapshot.errorCode !== null && RETRYABLE_DRAFT_ERROR_CODES.has(snapshot.errorCode);
          setDraftError(draftId, retryable ? t('failedRetryable') : t('extractionFailed'));
          toast.error(t('failedTitle', { title }), {
            description: retryable ? t('failedRetryable') : t('failedTryAgain'),
          });
          cleanupProcessing();
          return;
        }
        if (mapped === null) {
          cleanupProcessing();
          return;
        }

        // Still in flight — surface flat progress.
        updateDraftProgress(draftId, {
          chunksProcessed: 0,
          chunksTotal: 1,
          questionsCount: snapshot.questions.length,
          status: 'processing',
        });

        try {
          await sleep(POLL_INTERVAL_MS, abortController.signal);
        } catch {
          cleanupProcessing();
          return;
        }
      }

      // Hit the cap.
      setDraftError(draftId, t('timedOut'));
      toast.error(t('timedOutTitle', { title }), { description: t('failedTryAgain') });
      cleanupProcessing();
    } catch (error) {
      cleanupProcessing();
      throw error;
    }
  };

  const stopProcessing = (draftId: string) => {
    const controller = abortControllersRef.current[draftId];
    if (controller) {
      controller.abort();
      delete abortControllersRef.current[draftId];
    }
    delete processingRef.current[draftId];
  };

  const resumeProcessing = async (draftId: string) => {
    try {
      const draft = await getQuizDraft(draftId);
      // Only (re)start polling while the draft is still in flight.
      if (mapDraftStatus(draft.status) !== 'processing') return;

      await startProcessing(draftId, draft.title);
    } catch (error) {
      console.error('Resume processing error:', error);
    }
  };

  return {
    startProcessing,
    stopProcessing,
    resumeProcessing,
  };
}
