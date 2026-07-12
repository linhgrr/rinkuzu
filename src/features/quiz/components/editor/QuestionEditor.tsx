'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { QuestionImageUpload, OptionImageUpload } from '@/components/ui/ImageUpload';
import { HiOutlineDocumentText, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi';
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
  const t = useTranslations('create');
  const tCommon = useTranslations('common');

  if (!canEdit) return null;

  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <HiOutlineDocumentText className="size-5 text-brand-trust" />
                {t('questionsCount', { count: questions.length })}
              </CardTitle>
              <CardDescription>{t('editQuestionsBelow')}</CardDescription>
            </div>
            <Button
              type="button"
              onClick={onAddQuestion}
              size="sm"
              variant="default"
              className="flex items-center gap-2"
            >
              <HiOutlinePlus className="size-4" />
              {t('addQuestion')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((q, index) => {
            const questionKey = q.editorId;
            return (
              <div key={questionKey} className="space-y-4 rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <h4 className="flex items-center gap-2 font-medium">
                    <div className="flex size-6 items-center justify-center rounded-full bg-green-100 text-xs text-brand-trust">
                      {index + 1}
                    </div>
                    {t('questionNumber', { number: index + 1 })}
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSetQuestionToRemove(index)}
                    className="rounded-full px-3 text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <HiOutlineTrash className="mr-1 size-4" />
                    {t('remove')}
                  </Button>
                </div>

                <Textarea
                  value={q.question}
                  onChange={(e) => onUpdateField(index, 'question', e.target.value)}
                  className="min-h-[88px]"
                  rows={2}
                  placeholder={t('enterQuestion')}
                />

                <QuestionImageUpload
                  currentImage={q.questionImage}
                  onImageUploaded={(url) => onUpdateQuestionImage(index, url)}
                  onImageRemoved={() => onRemoveQuestionImage(index)}
                />

                <div>
                  <p className="mb-1 text-sm font-medium">{t('questionType')}</p>
                  <div className="mt-1 flex gap-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={q.type === 'single'}
                        onChange={() => onToggleType(index, 'single')}
                      />
                      <span className="ml-2 text-sm">{t('singleChoice')}</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={q.type === 'multiple'}
                        onChange={() => onToggleType(index, 'multiple')}
                      />
                      <span className="ml-2 text-sm">{t('multipleChoice')}</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  {q.options.map((opt, optIdx) => (
                    <div key={`${questionKey}:option:${optIdx}`} className="space-y-2">
                      <div className="flex items-center gap-x-2">
                        {q.type === 'single' ? (
                          <input
                            type="radio"
                            aria-label={t('markCorrectAnswer', { number: optIdx + 1 })}
                            name={`correct-${questionKey}`}
                            checked={q.correctIndex === optIdx}
                            onChange={() => onSetSingleCorrect(index, optIdx)}
                          />
                        ) : (
                          <input
                            type="checkbox"
                            aria-label={t('markCorrectAnswer', { number: optIdx + 1 })}
                            checked={q.correctIndexes.includes(optIdx)}
                            onChange={(e) =>
                              onToggleMultipleCorrect(index, optIdx, e.target.checked)
                            }
                          />
                        )}
                        <Input
                          value={opt}
                          onChange={(e) => onUpdateOption(index, optIdx, e.target.value)}
                          className="flex-1"
                          placeholder={t('optionPlaceholder', { number: optIdx + 1 })}
                        />
                      </div>
                      <div className="pl-7">
                        <OptionImageUpload
                          currentImage={q.optionImages?.[optIdx]}
                          onImageUploaded={(url) => onUpdateOptionImage(index, optIdx, url)}
                          onImageRemoved={() => onRemoveOptionImage(index, optIdx)}
                        />
                      </div>
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
        title={t('confirmRemoveQuestionTitle')}
        message={
          questionToRemove !== null
            ? t('confirmRemoveQuestionUnsaved', { number: questionToRemove + 1 })
            : ''
        }
        confirmText={tCommon('remove')}
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
