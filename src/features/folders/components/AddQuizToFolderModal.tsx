'use client';

import { useEffect, useReducer, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ModalListSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useApiErrorToast } from '@/lib/api/use-api-error';
import {
  addQuizToFolderViewModel,
  fetchFolderLibraryQuizViewModels,
} from '@/features/folders/api/folders-api';
import type { FolderLibraryQuizViewModel } from '@/features/folders/types/folder-view-model';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';

interface State {
  quizzes: FolderLibraryQuizViewModel[];
  search: string;
  loading: boolean;
  addingId: string | null;
  /** Load failure, rendered by ErrorState from the error layer (RIN-755). */
  loadError: unknown;
}

type Action =
  | { type: 'load:start' }
  | { type: 'load:success'; quizzes: FolderLibraryQuizViewModel[] }
  | { type: 'load:error'; error: unknown }
  | { type: 'search:set'; search: string }
  | { type: 'add:start'; quizId: string }
  | { type: 'add:success'; quizId: string; folder: string | null }
  | { type: 'add:error' };

const initialState: State = {
  quizzes: [],
  search: '',
  loading: false,
  addingId: null,
  loadError: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load:start':
      return { ...state, loading: true, loadError: null };
    case 'load:success':
      return { ...state, quizzes: action.quizzes, loading: false, loadError: null };
    case 'load:error':
      return { ...state, loading: false, loadError: action.error };
    case 'search:set':
      return { ...state, search: action.search };
    case 'add:start':
      return { ...state, addingId: action.quizId };
    case 'add:success':
      return {
        ...state,
        addingId: null,
        quizzes: state.quizzes.map((quiz) =>
          quiz.id === action.quizId ? { ...quiz, folder: action.folder } : quiz,
        ),
      };
    case 'add:error':
      return { ...state, addingId: null };
  }
}

export function AddQuizToFolderModal({
  folderId,
  isOpen,
  onClose,
  onAdded,
}: {
  folderId: string;
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const showMutationError = useApiErrorToast();

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    dispatch({ type: 'load:start' });

    async function loadQuizzes() {
      try {
        const quizzes = await fetchFolderLibraryQuizViewModels();
        if (active) dispatch({ type: 'load:success', quizzes });
      } catch (requestError) {
        if (active) {
          dispatch({ type: 'load:error', error: requestError });
        }
      }
    }

    void loadQuizzes();
    return () => {
      active = false;
    };
  }, [isOpen, loadAttempt]);

  const query = state.search.trim().toLowerCase();
  const visibleQuizzes = query
    ? state.quizzes.filter((quiz) => quiz.title.toLowerCase().includes(query))
    : state.quizzes;

  async function addQuiz(quizId: string) {
    dispatch({ type: 'add:start', quizId });
    try {
      await addQuizToFolderViewModel(folderId, quizId);
      dispatch({
        type: 'add:success',
        quizId,
        folder: folderId === UNFILED_FOLDER_TARGET ? null : folderId,
      });
      onAdded();
    } catch (requestError) {
      dispatch({ type: 'add:error' });
      showMutationError(requestError);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add quiz"
      description="Choose from quizzes you created or completed."
      size="large"
    >
      <div className="space-y-4">
        <Input
          aria-label="Search quizzes"
          placeholder="Search quizzes"
          value={state.search}
          onChange={(event) => dispatch({ type: 'search:set', search: event.target.value })}
        />
        {state.loadError ? (
          <ErrorState
            error={state.loadError}
            onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
          />
        ) : null}
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {state.loading ? <ModalListSkeleton label="Loading quizzes…" /> : null}
          {!state.loading && visibleQuizzes.length === 0 ? (
            <EmptyState title="No quizzes found." className="py-8" />
          ) : null}
          {visibleQuizzes.map((quiz) => {
            const isCurrent =
              quiz.folder === folderId ||
              (folderId === UNFILED_FOLDER_TARGET && quiz.folder === null);
            return (
              <div
                key={quiz.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-line p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{quiz.title}</p>
                  <p className="mt-1 text-xs text-ink/70">
                    {quiz.ownedByMe ? 'Created by you' : 'Completed quiz'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isCurrent ? 'outline' : 'primary'}
                  disabled={isCurrent}
                  loading={state.addingId === quiz.id}
                  onClick={() => void addQuiz(quiz.id)}
                >
                  {isCurrent ? 'Added' : 'Add'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
