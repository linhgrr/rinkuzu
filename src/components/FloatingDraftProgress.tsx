// /src/components/FloatingDraftProgress.tsx
'use client';

import { useState, useEffect } from 'react';
import { useDraftStore, DraftProgress } from '@/store/useDraftStore';
import { usePdfProcessor } from '@/hooks/usePdfProcessor';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  HiOutlineDocumentText,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineX,
  HiOutlineChevronUp,
  HiOutlineRefresh,
} from '@/components/icons';

export function FloatingDraftProgress() {
  const { getActiveDrafts, getProcessingCount, getCompletedCount, removeDraft, hasActiveDrafts } = useDraftStore();
  const { stopProcessing } = usePdfProcessor();
  const t = useTranslations('draft');
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  const drafts = getActiveDrafts();
  const processingCount = getProcessingCount();
  const completedCount = getCompletedCount();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !hasActiveDrafts()) {
    return null;
  }

  const handleCancel = async (id: string, title: string) => {
    stopProcessing(id);

    // Notify server to delete the draft
    try {
      await fetch(`/api/draft/${id}`, { method: 'DELETE' });
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
                       shadow-xl border border-gray-200/60 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-900">{t('processingPDF')}</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <HiOutlineX className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {drafts.map((draft) => (
              <DraftItem
                key={draft.id}
                draft={draft}
                onRemove={() => removeDraft(draft.id)}
                onCancel={() => handleCancel(draft.id, draft.title)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full
                   bg-white/95 backdrop-blur-xl shadow-lg border border-gray-200/60
                   hover:shadow-xl active:scale-[0.97] transition-all duration-200"
      >
        {processingCount > 0 ? (
          <div className="relative">
            <HiOutlineDocumentText className="w-5 h-5 text-blue-500" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          </div>
        ) : (
          <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />
        )}

        <span className="text-sm font-medium text-gray-700">
          {processingCount > 0
            ? t('processingFiles', { count: processingCount })
            : t('quizzesReady', { count: completedCount })}
        </span>

        <HiOutlineChevronUp
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? '' : 'rotate-180'
            }`}
        />
      </button>
    </div>
  );
}

function getTimeRemaining(expiresAt: string, t: (key: string, params?: Record<string, any>) => string): string {
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
  t: (key: string, params?: Record<string, any>) => string;
}) {
  const progress = draft.chunksTotal > 0
    ? (draft.chunksProcessed / draft.chunksTotal) * 100
    : 0;

  const errorProgress = draft.chunksTotal > 0
    ? ((draft.chunksError || 0) / draft.chunksTotal) * 100
    : 0;

  return (
    <div className="px-4 py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-gray-900 truncate">
              {draft.title}
            </p>
            {draft.expiresAt && (
              <span className="text-xs text-gray-400 flex-shrink-0">
                ~ {getTimeRemaining(draft.expiresAt, t)}
              </span>
            )}
          </div>

          {draft.status === 'processing' || draft.status === 'uploading' ? (
            <>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-blue-500 transition-[width] duration-300"
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
                <p className="text-xs text-gray-500">
                  {t('chunksCompleted', { completed: draft.chunksProcessed, total: draft.chunksTotal })}
                  {(draft.chunksError || 0) > 0 && (
                    <span className="text-red-500"> • {t('errors', { count: draft.chunksError })}</span>
                  )}
                  {' • '}{t('questionsGenerated', { count: draft.questionsCount })}
                </p>
                <button
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
                         text-blue-600 hover:text-blue-700 font-medium"
            >
              <HiOutlineCheckCircle className="w-3.5 h-3.5" />
              {t('clickToEdit', { count: draft.questionsCount })}
            </Link>
          ) : draft.status === 'error' ? (
            <div className="mt-1.5">
              <span className="text-xs text-red-500 flex items-center gap-1">
                <HiOutlineExclamationCircle className="w-3.5 h-3.5" />
                {draft.error || t('processingError')}
              </span>
            </div>
          ) : null}
        </div>

        {draft.status === 'completed' && (
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <HiOutlineX className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
