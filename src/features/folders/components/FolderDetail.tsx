'use client';

import Link from 'next/link';
import { useEffect, useReducer } from 'react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { HiOutlineArrowLeft, HiOutlineFolder, HiOutlinePlus } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { QuizCard, QuizCardSkeleton } from '@/features/quiz/components/QuizCard';
import { deleteQuizById } from '@/features/quiz/api/quiz-api';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { fetchFolderDetailQuizViewModels } from '@/features/folders/api/folders-api';
import type { FolderLibraryQuizViewModel } from '@/features/folders/types/folder-view-model';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';
import { useFolders } from '../hooks/useFolders';
import { AddQuizToFolderModal } from './AddQuizToFolderModal';

interface State {
  quizzes: FolderLibraryQuizViewModel[];
  loading: boolean;
  error: string;
  quizToDelete: FolderLibraryQuizViewModel | null;
  showAddQuiz: boolean;
}

type Action =
  | { type: 'load:start' }
  | { type: 'load:success'; quizzes: FolderLibraryQuizViewModel[] }
  | { type: 'load:error'; error: string }
  | { type: 'delete:prompt'; quiz: FolderLibraryQuizViewModel }
  | { type: 'delete:success'; quizId: string }
  | { type: 'delete:cancel' }
  | { type: 'modal:open' }
  | { type: 'modal:close' };

const initialState: State = {
  quizzes: [],
  loading: true,
  error: '',
  quizToDelete: null,
  showAddQuiz: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load:start':
      return { ...state, loading: true, error: '' };
    case 'load:success':
      return { ...state, quizzes: action.quizzes, loading: false, error: '' };
    case 'load:error':
      return { ...state, loading: false, error: action.error };
    case 'delete:prompt':
      return { ...state, quizToDelete: action.quiz };
    case 'delete:success':
      return {
        ...state,
        quizzes: state.quizzes.filter((quiz) => quiz.id !== action.quizId),
        quizToDelete: null,
      };
    case 'delete:cancel':
      return { ...state, quizToDelete: null };
    case 'modal:open':
      return { ...state, showAddQuiz: true };
    case 'modal:close':
      return { ...state, showAddQuiz: false };
  }
}

export function FolderDetail({ folderId }: { folderId: string }) {
  const locale = useLocale();
  const { folders, isLoading: foldersLoading } = useFolders();
  const [state, dispatch] = useReducer(reducer, initialState);
  const isUnfiled = folderId === UNFILED_FOLDER_TARGET;
  const folder = folders.find((item) => item.id === folderId);

  async function reloadQuizzes() {
    dispatch({ type: 'load:start' });
    try {
      const quizzes = await fetchFolderDetailQuizViewModels(folderId, isUnfiled);
      dispatch({ type: 'load:success', quizzes });
    } catch (requestError) {
      dispatch({
        type: 'load:error',
        error: extractUnknownErrorMessage(requestError, 'Failed to load quizzes'),
      });
    }
  }

  useEffect(() => {
    let active = true;
    dispatch({ type: 'load:start' });

    async function loadQuizzes() {
      try {
        const quizzes = await fetchFolderDetailQuizViewModels(folderId, isUnfiled);
        if (active) dispatch({ type: 'load:success', quizzes });
      } catch (requestError) {
        if (active) {
          dispatch({
            type: 'load:error',
            error: extractUnknownErrorMessage(requestError, 'Failed to load quizzes'),
          });
        }
      }
    }

    void loadQuizzes();
    return () => {
      active = false;
    };
  }, [folderId, isUnfiled]);

  async function deleteQuiz() {
    if (!state.quizToDelete) return;
    try {
      await deleteQuizById(state.quizToDelete.id);
      dispatch({ type: 'delete:success', quizId: state.quizToDelete.id });
      toast.success('Quiz deleted');
    } catch (requestError) {
      toast.error(extractUnknownErrorMessage(requestError, 'Failed to delete quiz'));
    }
  }

  const title = isUnfiled ? 'My folder' : folder?.name;

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
            <p className="text-sm text-ink/55">{state.quizzes.length} quizzes</p>
          </div>
        </div>
        <Button onClick={() => dispatch({ type: 'modal:open' })}>
          <HiOutlinePlus className="size-4" /> Add quiz
        </Button>
      </header>

      {state.error ? <ErrorState message={state.error} className="mt-6 rounded-xl" /> : null}
      {state.loading ? (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }, (_, index) => (
            <QuizCardSkeleton key={index} />
          ))}
        </div>
      ) : state.quizzes.length ? (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {state.quizzes.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              quizId={quiz.id}
              locale={locale}
              onDelete={
                quiz.ownedByMe ? () => dispatch({ type: 'delete:prompt', quiz }) : undefined
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="This folder has no quizzes."
          className="mt-10 rounded-2xl border border-dashed border-line"
        />
      )}

      <ConfirmModal
        isOpen={!!state.quizToDelete}
        title="Delete quiz"
        message={`Delete “${state.quizToDelete?.title ?? ''}”?`}
        confirmText="Delete"
        confirmVariant="destructive"
        onCancel={() => dispatch({ type: 'delete:cancel' })}
        onConfirm={() => void deleteQuiz()}
      />
      <AddQuizToFolderModal
        folderId={folderId}
        isOpen={state.showAddQuiz}
        onClose={() => dispatch({ type: 'modal:close' })}
        onAdded={() => void reloadQuizzes()}
      />
    </main>
  );
}
