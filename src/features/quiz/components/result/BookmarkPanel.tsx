'use client';

import { ConfirmModal } from '@/components/ui/ConfirmModal';

type BookmarkMessageTone = 'success' | 'warning' | 'error';

interface BookmarkPanelProps {
  bookmarkMessage: string;
  bookmarkMessageTone: BookmarkMessageTone;
  onDismissMessage: () => void;
  bookmarkToRemove: number | null;
  bookmarkLoading: Set<number>;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  t: (key: string) => string;
}

export function BookmarkPanel({
  bookmarkMessage,
  bookmarkMessageTone,
  onDismissMessage,
  bookmarkToRemove,
  bookmarkLoading,
  onCancelRemove,
  onConfirmRemove,
  t,
}: BookmarkPanelProps) {
  return (
    <>
      {/* Bookmark Message */}
      {bookmarkMessage && (
        <div
          className={`mb-4 p-4 rounded-lg border ${
            bookmarkMessageTone === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : bookmarkMessageTone === 'warning'
                ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{bookmarkMessage}</span>
            <button onClick={onDismissMessage} className="text-neutral-500 hover:text-neutral-700">
              {'✕'}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={bookmarkToRemove !== null}
        title={t('removeBookmarkTitle')}
        message={t('removeBookmarkConfirm')}
        confirmText={t('removeBookmark')}
        onCancel={onCancelRemove}
        onConfirm={onConfirmRemove}
        isLoading={bookmarkToRemove !== null && bookmarkLoading.has(bookmarkToRemove)}
      />
    </>
  );
}
