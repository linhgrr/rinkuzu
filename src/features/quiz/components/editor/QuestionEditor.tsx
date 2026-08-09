'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { QuestionImageUpload, OptionImageUpload } from '@/components/ui/ImageUpload';
import {
  HiOutlineDocumentText,
  HiOutlinePhotograph,
  HiOutlinePlus,
  HiOutlineTrash,
} from 'react-icons/hi';
import type { QuizEditorQuestionViewModel } from '@/features/quiz/types/quiz-editor-view-model';
import type { QuestionType } from '@/shared/constants/question-type';
import { MAX_OPTION_COUNT, MIN_OPTION_COUNT } from '@/lib/validation/question';

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
  onAddOption: (qIdx: number) => void;
  onRemoveOption: (qIdx: number, optIdx: number) => void;
  onUpdateQuestionImage: (qIdx: number, url: string) => void;
  onRemoveQuestionImage: (qIdx: number) => void;
  onUpdateOptionImage: (qIdx: number, optIdx: number, url: string) => void;
  onRemoveOptionImage: (qIdx: number, optIdx: number) => void;
  onAddQuestion: () => void;
  onInsertQuestion: (index: number) => void;
  onRemoveQuestion: (idx: number) => void;
  onToggleType: (idx: number, type: QuestionType) => void;
  onSetSingleCorrect: (qIdx: number, optIdx: number) => void;
  onToggleMultipleCorrect: (qIdx: number, optIdx: number, checked: boolean) => void;
  onSetQuestionToRemove: (idx: number | null) => void;
  invalidQuestionIndexes?: number[];
}

export function QuestionEditor({
  questions,
  canEdit,
  questionToRemove,
  onUpdateField,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  onUpdateQuestionImage,
  onRemoveQuestionImage,
  onUpdateOptionImage,
  onRemoveOptionImage,
  onAddQuestion,
  onInsertQuestion,
  onRemoveQuestion,
  onToggleType,
  onSetSingleCorrect,
  onToggleMultipleCorrect,
  onSetQuestionToRemove,
  invalidQuestionIndexes = [],
}: QuestionEditorProps) {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const [visibleImageEditors, setVisibleImageEditors] = useState<Set<string>>(() => new Set());

  const showImageEditor = (key: string) => {
    setVisibleImageEditors((current) => new Set(current).add(key));
  };

  if (!canEdit) return null;

  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
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
              <Fragment key={questionKey}>
                <div
                  id={`quiz-question-${index}`}
                  className={`scroll-mt-24 space-y-4 rounded-lg border p-3 sm:p-4 ${
                    invalidQuestionIndexes.includes(index)
                      ? 'border-red-300 bg-red-50/40'
                      : 'border-[var(--border-default)]'
                  }`}
                >
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

                  {q.questionImage || visibleImageEditors.has(`${questionKey}:question-image`) ? (
                    <QuestionImageUpload
                      {...(q.questionImage !== undefined ? { currentImage: q.questionImage } : {})}
                      onImageUploaded={(url) => onUpdateQuestionImage(index, url)}
                      onImageRemoved={() => onRemoveQuestionImage(index)}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2 !text-neutral-600"
                      onClick={() => showImageEditor(`${questionKey}:question-image`)}
                    >
                      <HiOutlinePhotograph className="size-4" />
                      {t('addQuestionImage')}
                    </Button>
                  )}

                  <div>
                    <p className="mb-1 text-sm font-medium">{t('questionType')}</p>
                    <div className="mt-1 flex gap-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name={`question-type-${questionKey}`}
                          checked={q.type === 'single'}
                          onChange={() => onToggleType(index, 'single')}
                        />
                        <span className="ml-2 text-sm">{t('singleChoice')}</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name={`question-type-${questionKey}`}
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={t('removeOption', { number: optIdx + 1 })}
                            disabled={q.options.length <= MIN_OPTION_COUNT}
                            onClick={() => onRemoveOption(index, optIdx)}
                            className="text-neutral-400 hover:text-red-600"
                          >
                            <HiOutlineTrash className="size-4" />
                          </Button>
                        </div>
                        <div className="pl-7">
                          {q.optionImages?.[optIdx] ||
                          visibleImageEditors.has(`${questionKey}:option-image:${optIdx}`) ? (
                            <OptionImageUpload
                              {...(q.optionImages?.[optIdx] !== undefined
                                ? { currentImage: q.optionImages[optIdx] }
                                : {})}
                              onImageUploaded={(url) => onUpdateOptionImage(index, optIdx, url)}
                              onImageRemoved={() => onRemoveOptionImage(index, optIdx)}
                            />
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-2 !text-neutral-500"
                              onClick={() =>
                                showImageEditor(`${questionKey}:option-image:${optIdx}`)
                              }
                            >
                              <HiOutlinePhotograph className="size-4" />
                              {t('addOptionImage')}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={q.options.length >= MAX_OPTION_COUNT}
                      onClick={() => onAddOption(index)}
                      className="gap-2"
                    >
                      <HiOutlinePlus className="size-4" />
                      {t('addOption')}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-neutral-200" aria-hidden="true" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onInsertQuestion(index + 1)}
                    className="gap-1.5 !text-neutral-700 hover:!text-neutral-950"
                  >
                    <HiOutlinePlus className="size-4" />
                    {t('addQuestionHere')}
                  </Button>
                  <span className="h-px flex-1 bg-neutral-200" aria-hidden="true" />
                </div>
              </Fragment>
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
