// /src/components/FloatingDraftProgress.tsx
'use client';

import { useState, useEffect } from 'react';
import { useDraftStore, DraftProgress } from '@/store/useDraftStore';
import { usePdfProcessor } from '@/hooks/usePdfProcessor';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { toast } from 'sonner';
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
  const { resumeProcessing, stopProcessing } = usePdfProcessor();
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  const drafts = getActiveDrafts();
  const processingCount = getProcessingCount();
  const completedCount = getCompletedCount();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Resume any interrupted processing on mount
  useEffect(() => {
    if (mounted) {
      drafts
        .filter(d => d.status === 'processing')
        .forEach(d => resumeProcessing(d.id));
    }
  }, [mounted]); // Run when mounted

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
    toast.success(`Đã hủy xử lý "${title}"`);
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="mb-3 w-80 rounded-2xl bg-white/95 backdrop-blur-xl
                       shadow-xl border border-gray-200/60 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900">Đang xử lý PDF</h3>
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
                  onRetry={() => resumeProcessing(draft.id)}
                  onCancel={() => handleCancel(draft.id, draft.title)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full
                   bg-white/95 backdrop-blur-xl shadow-lg border border-gray-200/60
                   hover:shadow-xl transition-all duration-200"
        whileTap={{ scale: 0.97 }}
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
            ? `Đang xử lý ${processingCount} file`
            : `${completedCount} quiz sẵn sàng`}
        </span>

        <HiOutlineChevronUp
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? '' : 'rotate-180'
            }`}
        />
      </motion.button>
    </div>
  );
}

function DraftItem({
  draft,
  onRemove,
  onRetry,
  onCancel,
}: {
  draft: DraftProgress;
  onRemove: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const progress = draft.chunksTotal > 0
    ? (draft.chunksProcessed / draft.chunksTotal) * 100
    : 0;

  return (
    <div className="px-4 py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">
            {draft.title}
          </p>

          {draft.status === 'processing' || draft.status === 'uploading' ? (
            <>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {draft.chunksProcessed}/{draft.chunksTotal} phần •{' '}
                  {draft.questionsCount} câu hỏi
                </p>
                <button
                  onClick={onCancel}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Hủy
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
              {draft.questionsCount} câu hỏi – Bấm để chỉnh sửa
            </Link>
          ) : draft.status === 'error' ? (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-red-500 flex items-center gap-1">
                <HiOutlineExclamationCircle className="w-3.5 h-3.5" />
                {draft.error || 'Lỗi xử lý'}
              </span>
              <button
                onClick={onRetry}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <HiOutlineRefresh className="w-3 h-3" />
                Thử lại
              </button>
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
