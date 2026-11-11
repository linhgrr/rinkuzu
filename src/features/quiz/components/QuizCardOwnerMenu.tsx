'use client';

import { useTranslations } from 'next-intl';
import { HiOutlineDotsVertical } from 'react-icons/hi';
import { Link } from '@/i18n/navigation';

interface QuizCardOwnerMenuProps {
  quizId: string;
  onDelete: () => void;
}

/** The owner's Edit / Delete menu. The only interactive part of QuizCard (RIN-1466). */
export function QuizCardOwnerMenu({ quizId, onDelete }: QuizCardOwnerMenuProps) {
  const t = useTranslations('profile');
  return (
    <details className="relative">
      <summary
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-ink/70 transition-colors hover:bg-accent-soft hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={t('quizActions')}
      >
        <HiOutlineDotsVertical className="size-5" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-line bg-white py-1 text-sm text-ink shadow-lg">
        <Link
          href={`/edit/${quizId}`}
          className="flex min-h-11 items-center px-3 py-2 hover:bg-surface-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          {t('edit')}
        </Link>
        <button
          type="button"
          onClick={onDelete}
          className="flex min-h-11 w-full items-center px-3 py-2 text-left text-error hover:bg-error-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-error"
        >
          {t('deleteQuiz')}
        </button>
      </div>
    </details>
  );
}
