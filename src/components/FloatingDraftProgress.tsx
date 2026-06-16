// /src/components/FloatingDraftProgress.tsx
'use client';

import { useState, useSyncExternalStore } from 'react';
import { useDraftStore, DraftProgress } from '@/store/useDraftStore';
import { usePdfProcessor } from '@/hooks/usePdfProcessor';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { fetchApiData } from '@/lib/api/client';
import {
  HiOutlineDocumentText,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineX,
  HiOutlineChevronUp,
} from '@/components/icons';

type DraftTranslationValues = Record<string, string | number | Date>;

function subscribeToClientMount() {
  return () => {};
}

export function FloatingDraftProgress() {
  const { getActiveDrafts, getProcessingCount, getCompletedCount, removeDraft, hasActiveDrafts } =
    useDraftStore();
  const { stopProcessing } = usePdfProcessor();
  const t = useTranslations('draft');
  const [isExpanded, setIsExpanded] = useState(false);
  const [draftToCancel, setDraftToCancel] = useState<DraftProgress | null>(null);
  const [draftToRemove, setDraftToRemove] = useState<DraftProgress | null>(null);
  const mounted = useSyncExternalStore(
    subscribeToClientMount,
    () => true,
    () => false,
  );

  const drafts = getActiveDrafts();
  const processingCount = getProcessingCount();
  const completedCount = getCompletedCount();

  if (!mounted || !hasActiveDrafts()) {
    return null;
  }

  const handleCancel = async (id: string, title: string) => {
    stopProcessing(id);

    // Notify server to delete the draft
    try {
      await fetchApiData<null>(`/api/quiz-drafts/${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete draft on server:', error);
    }

    removeDraft(id);
    toast.success(t('cancelledProcessing', { title }));
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6">
      {isExpanded && (
        <div
          className="mb-3 w-80 rounded-2xl bg-white/95 backdrop-blur-xl
                       shadow-xl border border-neutral-200/60 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-neutral-900">{t('processingPDF')}</h3>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <HiOutlineX className="size-4" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {drafts.map((draft) => (
              <DraftItem
                key={draft.id}
                draft={draft}
                onRemove={() => setDraftToRemove(draft)}
                onCancel={() => setDraftToCancel(draft)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full
                   bg-white/95 backdrop-blur-xl shadow-lg border border-neutral-200/60
                   hover:shadow-xl active:scale-[0.97] transition-all duration-200"
      >
        {processingCount > 0 ? (
          <div className="relative">
            <HiOutlineDocumentText className="size-5 text-brand-action" />
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-brand-action animate-pulse" />
          </div>
        ) : (
          <HiOutlineCheckCircle className="size-5 text-green-500" />
        )}

        <span className="text-sm font-medium text-neutral-700">
          {processingCount > 0
            ? t('processingFiles', { count: processingCount })
            : t('quizzesReady', { count: completedCount })}
        </span>

        <HiOutlineChevronUp
          className={`size-4 text-neutral-400 transition-transform duration-200 ${
            isExpanded ? '' : 'rotate-180'
          }`}
        />
      </button>
      <ConfirmModal
        isOpen={!!draftToCancel}
        title={t('cancelConfirmTitle')}
        message={draftToCancel ? t('cancelConfirmMessage', { title: draftToCancel.title }) : ''}
        confirmText={t('cancel')}
        onCancel={() => setDraftToCancel(null)}
        onConfirm={async () => {
          if (!draftToCancel) return;
          await handleCancel(draftToCancel.id, draftToCancel.title);
          setDraftToCancel(null);
        }}
      />
      <ConfirmModal
        isOpen={!!draftToRemove}
        title={t('removeReadyDraftTitle')}
        message={draftToRemove ? t('removeReadyDraftMessage', { title: draftToRemove.title }) : ''}
        confirmText={t('remove')}
        onCancel={() => setDraftToRemove(null)}
        onConfirm={() => {
          if (!draftToRemove) return;
          removeDraft(draftToRemove.id);
          setDraftToRemove(null);
        }}
      />
    </div>
  );
}

function getTimeRemaining(
  expiresAt: string,
  t: (key: string, params?: DraftTranslationValues) => string,
): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return t('expired');

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return t('days', { count: days });
  }

  if (hours > 0) {
    return t('hoursMinutes', { hours, minutes });
  }

  return t('minutes', { count: minutes });
}

function DraftItem({
  draft,
  onRemove,
  onCancel,
  t,
}: {
  draft: DraftProgress;
  onRemove: () => void;
  onCancel: () => void;
  t: (key: string, params?: DraftTranslationValues) => string;
}) {
  const progress = draft.chunksTotal > 0 ? (draft.chunksProcessed / draft.chunksTotal) * 100 : 0;

  const errorProgress =
    draft.chunksTotal > 0 ? ((draft.chunksError || 0) / draft.chunksTotal) * 100 : 0;

  return (
    <div className="px-4 py-3 border-b border-neutral-50 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-neutral-900 truncate">{draft.title}</p>
            {draft.expiresAt && (
              <span className="text-xs text-neutral-400 flex-shrink-0">
                ~ {getTimeRemaining(draft.expiresAt, t)}
              </span>
            )}
          </div>

          {draft.status === 'processing' || draft.status === 'uploading' ? (
            <>
              <div className="mt-2 h-1.5 bg-neutral-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-brand-trust transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
                {errorProgress > 0 && (
                  <div
                    className="h-full bg-red-400 transition-[width] duration-300"
                    style={{ width: `${errorProgress}%` }}
                  />
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-xs text-neutral-500">
                  {t('chunksCompleted', {
                    completed: draft.chunksProcessed,
                    total: draft.chunksTotal,
                  })}
                  {(draft.chunksError || 0) > 0 && (
                    <span className="text-red-500">
                      {' '}
                      • {t('errors', { count: draft.chunksError ?? 0 })}
                    </span>
                  )}
                  {' • '}
                  {t('questionsGenerated', { count: draft.questionsCount ?? 0 })}
                </p>
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  {t('cancel')}
                </button>
              </div>
            </>
          ) : draft.status === 'completed' ? (
            <Link
              href={`/draft/${draft.id}/edit`}
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs
                         text-brand-trust hover:text-brand-trust-hover font-medium"
            >
              <HiOutlineCheckCircle className="size-3.5" />
              {t('clickToEdit', { count: draft.questionsCount })}
            </Link>
          ) : draft.status === 'error' ? (
            <div className="mt-1.5">
              <span className="text-xs text-red-500 flex items-center gap-1">
                <HiOutlineExclamationCircle className="size-3.5" />
                {draft.error || t('processingError')}
              </span>
            </div>
          ) : null}
        </div>

        {draft.status === 'completed' && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <HiOutlineX className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
