'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { HiOutlineArrowLeft, HiOutlineFolder, HiOutlinePlus } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { QuizCard, QuizCardSkeleton } from '@/features/quiz/components/QuizCard';
import { fetchApiData, fetchApiResponse } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import type { IQuiz, PaginationMeta } from '@/types';
import { useFolders } from '../hooks/useFolders';
import { AddQuizToFolderModal } from './AddQuizToFolderModal';

type LibraryQuiz = IQuiz & { ownedByMe?: boolean };

export function FolderDetail({ folderId }: { folderId: string }) {
  const locale = useLocale();
  const { folders, isLoading: foldersLoading } = useFolders();
  const [quizzes, setQuizzes] = useState<LibraryQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quizToDelete, setQuizToDelete] = useState<IQuiz | null>(null);
  const [showAddQuiz, setShowAddQuiz] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const isDefault = folderId === 'default';
  const folder = folders.find((item) => item._id === folderId);

  useEffect(() => {
    let active = true;
    const folderParam = isDefault ? 'null' : folderId;
    fetchApiData<{ quizzes: LibraryQuiz[]; pagination: PaginationMeta }>(
      `/api/library?limit=100&folder=${encodeURIComponent(folderParam)}`,
    )
      .then((data) => {
        if (active) setQuizzes(data.quizzes);
      })
      .catch((requestError) => {
        if (active) setError(extractUnknownErrorMessage(requestError, 'Failed to load quizzes'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [folderId, isDefault, reloadKey]);

  async function deleteQuiz() {
    if (!quizToDelete) return;
    try {
      await fetchApiResponse(`/api/quizzes/${quizToDelete._id}`, { method: 'DELETE' });
      setQuizzes((current) => current.filter((quiz) => quiz._id !== quizToDelete._id));
      setQuizToDelete(null);
      toast.success('Quiz deleted');
    } catch (requestError) {
      toast.error(extractUnknownErrorMessage(requestError, 'Failed to delete quiz'));
    }
  }

  const title = isDefault ? 'My folder' : folder?.name;

  return (
    <main className="mx-auto max-w-[1340px] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <Link
        href="/my-quizzes?tab=folders"
        className="inline-flex items-center gap-2 text-sm text-ink/60 hover:text-brand-trust"
      >
        <HiOutlineArrowLeft className="size-4" /> Back to folders
      </Link>
      <header className="mt-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-surface-blue">
            <HiOutlineFolder className="size-6 text-brand-trust" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-ink">
              {title ?? (foldersLoading ? 'Loading…' : 'Folder not found')}
            </h1>
            <p className="text-sm text-ink/55">{quizzes.length} quizzes</p>
          </div>
        </div>
        <Button onClick={() => setShowAddQuiz(true)}>
          <HiOutlinePlus className="size-4" /> Add quiz
        </Button>
      </header>

      {error ? <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }, (_, index) => (
            <QuizCardSkeleton key={index} />
          ))}
        </div>
      ) : quizzes.length ? (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {quizzes.map((quiz) => (
            <QuizCard
              key={quiz._id}
              quiz={quiz}
              locale={locale}
              onDelete={quiz.ownedByMe ? setQuizToDelete : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-12 text-center text-ink/55">
          This folder has no quizzes.
        </div>
      )}

      <ConfirmModal
        isOpen={!!quizToDelete}
        title="Delete quiz"
        message={`Delete “${quizToDelete?.title ?? ''}”?`}
        confirmText="Delete"
        confirmVariant="destructive"
        onCancel={() => setQuizToDelete(null)}
        onConfirm={() => void deleteQuiz()}
      />
      <AddQuizToFolderModal
        folderId={folderId}
        isOpen={showAddQuiz}
        onClose={() => setShowAddQuiz(false)}
        onAdded={() => setReloadKey((current) => current + 1)}
      />
    </main>
  );
}
