'use client';

import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { HiOutlineDocumentText, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi';
import { QuestionImageManager } from './QuestionImageManager';
import type { QuizEditorQuestionViewModel } from '@/features/quiz/types/quiz-editor-view-model';

type EditorQuestion = QuizEditorQuestionViewModel;
type EditableQuestionField = 'question' | 'options' | 'questionImage' | 'optionImages';

interface QuestionEditorProps {
  questions: EditorQuestion[];
  canEdit: boolean;
  questionToRemove: number | null;
  onUpdateField: (
    index: number,
    field: EditableQuestionField,
    value: EditorQuestion[EditableQuestionField],
  ) => void;
  onUpdateOption: (qIdx: number, optIdx: number, value: string) => void;
  onUpdateQuestionImage: (qIdx: number, url: string) => void;
  onRemoveQuestionImage: (qIdx: number) => void;
  onUpdateOptionImage: (qIdx: number, optIdx: number, url: string) => void;
  onRemoveOptionImage: (qIdx: number, optIdx: number) => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (idx: number) => void;
  onToggleType: (idx: number, type: 'single' | 'multiple') => void;
  onSetSingleCorrect: (qIdx: number, optIdx: number) => void;
  onToggleMultipleCorrect: (qIdx: number, optIdx: number, checked: boolean) => void;
  onSetQuestionToRemove: (idx: number | null) => void;
}

export function QuestionEditor({
  questions,
  canEdit,
  questionToRemove,
  onUpdateField,
  onUpdateOption,
  onUpdateQuestionImage,
  onRemoveQuestionImage,
  onUpdateOptionImage,
  onRemoveOptionImage,
  onAddQuestion,
  onRemoveQuestion,
  onToggleType,
  onSetSingleCorrect,
  onToggleMultipleCorrect,
  onSetQuestionToRemove,
}: QuestionEditorProps) {
  if (!canEdit) return null;

  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <HiOutlineDocumentText className="size-5 text-brand-trust" />
                Questions ({questions.length})
              </CardTitle>
              <CardDescription>Edit questions below</CardDescription>
            </div>
            <Button
              type="button"
              onClick={onAddQuestion}
              size="sm"
              variant="default"
              className="flex items-center gap-2"
            >
              <HiOutlinePlus className="size-4" />
              Add Question
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((q, index) => {
            const questionKey = q.editorId;
            return (
              <div key={questionKey} className="border p-4 rounded-lg space-y-4">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-full bg-green-100 text-xs text-brand-trust">
                      {index + 1}
                    </div>
                    Question {index + 1}
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSetQuestionToRemove(index)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full px-3"
                  >
                    <HiOutlineTrash className="mr-1 size-4" />
                    Remove
                  </Button>
                </div>
                <Textarea
                  value={q.question}
                  onChange={(e) => onUpdateField(index, 'question', e.target.value)}
                  className="min-h-[88px]"
                  rows={2}
                />
                <QuestionImageManager
                  questionImage={q.questionImage}
                  optionImages={q.optionImages}
                  optionCount={q.options.length}
                  onQuestionImageUploaded={(url) => onUpdateQuestionImage(index, url)}
                  onQuestionImageRemoved={() => onRemoveQuestionImage(index)}
                  onOptionImageUploaded={(optIdx, url) => onUpdateOptionImage(index, optIdx, url)}
                  onOptionImageRemoved={(optIdx) => onRemoveOptionImage(index, optIdx)}
                />
                <div>
                  <p className="text-sm font-medium mb-1">Question Type</p>
                  <div className="mt-1 flex gap-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={q.type === 'single'}
                        onChange={() => onToggleType(index, 'single')}
                      />{' '}
                      <span className="ml-2 text-sm">Single</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={q.type === 'multiple'}
                        onChange={() => onToggleType(index, 'multiple')}
                      />{' '}
                      <span className="ml-2 text-sm">Multiple</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <div
                      key={`${questionKey}:option:${optIdx}`}
                      className="flex items-center gap-x-2"
                    >
                      {q.type === 'single' ? (
                        <input
                          type="radio"
                          aria-label={`Mark option ${optIdx + 1} as correct`}
                          name={`correct-${questionKey}`}
                          checked={q.correctIndex === optIdx}
                          onChange={() => onSetSingleCorrect(index, optIdx)}
                        />
                      ) : (
                        <input
                          type="checkbox"
                          aria-label={`Mark option ${optIdx + 1} as correct`}
                          checked={q.correctIndexes.includes(optIdx)}
                          onChange={(e) => onToggleMultipleCorrect(index, optIdx, e.target.checked)}
                        />
                      )}
                      <Input
                        value={opt}
                        onChange={(e) => onUpdateOption(index, optIdx, e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={questionToRemove !== null}
        title="Remove question?"
        message={
          questionToRemove !== null
            ? `Remove question ${questionToRemove + 1}? This change is not saved until you click Save.`
            : ''
        }
        confirmText="Remove"
        confirmVariant="destructive"
        onCancel={() => onSetQuestionToRemove(null)}
        onConfirm={() => {
          if (questionToRemove !== null) {
            onRemoveQuestion(questionToRemove);
            onSetQuestionToRemove(null);
          }
        }}
      />
    </>
  );
}
