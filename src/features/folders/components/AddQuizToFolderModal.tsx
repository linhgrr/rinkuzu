'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { fetchApiData } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import type { IQuiz, PaginationMeta } from '@/types';

type LibraryQuiz = IQuiz & {
  folder?: string | null;
  ownedByMe?: boolean;
  lastAttemptAt?: string | null;
  lastProgressAt?: string | null;
};

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
  const [quizzes, setQuizzes] = useState<LibraryQuiz[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    fetchApiData<{ quizzes: LibraryQuiz[]; pagination: PaginationMeta }>('/api/library?limit=100')
      .then((data) => setQuizzes(data.quizzes))
      .catch((requestError) =>
        setError(extractUnknownErrorMessage(requestError, 'Failed to load quizzes')),
      )
      .finally(() => setLoading(false));
  }, [isOpen]);

  const visibleQuizzes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? quizzes.filter((quiz) => quiz.title.toLowerCase().includes(query)) : quizzes;
  }, [quizzes, search]);

  async function addQuiz(quizId: string) {
    setAddingId(quizId);
    setError('');
    try {
      await fetchApiData(`/api/folders/${folderId}/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId }),
      });
      setQuizzes((current) =>
        current.map((quiz) => (quiz._id === quizId ? { ...quiz, folder: folderId } : quiz)),
      );
      onAdded();
    } catch (requestError) {
      setError(extractUnknownErrorMessage(requestError, 'Failed to add quiz'));
    } finally {
      setAddingId(null);
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
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-ink/55">Loading quizzes…</p>
          ) : null}
          {!loading && visibleQuizzes.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink/55">No quizzes found.</p>
          ) : null}
          {visibleQuizzes.map((quiz) => {
            const isCurrent = quiz.folder === folderId || (folderId === 'default' && !quiz.folder);
            return (
              <div
                key={quiz._id}
                className="flex items-center justify-between gap-4 rounded-xl border border-line p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{quiz.title}</p>
                  <p className="mt-1 text-xs text-ink/55">
                    {quiz.ownedByMe ? 'Created by you' : 'Completed quiz'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isCurrent ? 'outline' : 'primary'}
                  disabled={isCurrent}
                  loading={addingId === quiz._id}
                  onClick={() => void addQuiz(quiz._id)}
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
