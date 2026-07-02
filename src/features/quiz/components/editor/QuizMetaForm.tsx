'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { HiOutlinePencilAlt } from 'react-icons/hi';
import QuizMetaFormBase from '@/features/quiz/components/QuizMetaForm';
import { formatDate } from '@/lib/formatters';
import type { QuizEditViewModel } from '@/features/quiz/types/quiz-editor-view-model';

type QuizMetaFormEditorProps = {
  error: string;
  success: string;
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  selectedFolderId: string | null;
  onFolderChange: (folderId: string | null) => void;
  isPrivate: boolean;
  onPrivateChange: (checked: boolean) => void;
  disabled: boolean;
  quiz: QuizEditViewModel | null;
};

/**
 * Card wrapping the base QuizMetaForm with error/success display and quiz content info.
 */
export function QuizMetaFormEditor({
  error,
  success,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  selectedFolderId,
  onFolderChange,
  isPrivate,
  onPrivateChange,
  disabled,
  quiz,
}: QuizMetaFormEditorProps) {
  const createdAtIso = quiz?.createdAt ?? '';
  const createdAtLabel = formatDate(quiz?.createdAt, { emptyLabel: '' });

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HiOutlinePencilAlt className="size-5 text-brand-trust" />
          Quiz Information
        </CardTitle>
        <CardDescription>Update the basic information about your quiz</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}

        <QuizMetaFormBase
          title={title}
          onTitleChange={onTitleChange}
          description={description}
          onDescriptionChange={onDescriptionChange}
          selectedFolderId={selectedFolderId}
          onFolderChange={onFolderChange}
          labels={{
            title: 'Quiz Title',
            titlePlaceholder: 'Enter a descriptive title for your quiz',
            description: 'Description (Optional)',
            descriptionPlaceholder: 'Provide additional context about the quiz',
            folder: 'Folder',
            privateLabel: 'Private Quiz',
            privateDescription: '(Only visible to you and admins)',
          }}
          isPrivate={isPrivate}
          onPrivateChange={onPrivateChange}
          privateCheckboxId="isPrivate"
          disabled={disabled}
        />

        {/* Quiz Content Info */}
        {quiz && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Quiz Content</h3>
            <div className="bg-neutral-50 rounded-lg p-4">
              <div className="text-sm text-neutral-600">
                <p>
                  <strong>Questions:</strong> {quiz.questions.length}
                </p>
                <p>
                  <strong>Created:</strong>{' '}
                  <time dateTime={createdAtIso} suppressHydrationWarning>
                    {createdAtLabel}
                  </time>
                </p>
                <p>
                  <strong>Slug:</strong> {quiz.slug}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Note: Questions cannot be edited after creation. Create a new quiz to change
              questions.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
