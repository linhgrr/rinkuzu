'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { HiOutlineCheck, HiOutlinePencil, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { QuestionContent } from '@/components/ui/QuestionContent';
import {
  fetchAdminReportedQuestion,
  updateAdminReportedQuestion,
} from '@/features/admin/reports/api/admin-reports-api';
import type {
  AdminReportedQuestionViewModel,
  AdminReportViewModel,
} from '@/features/admin/reports/types/admin-reports-view-model';
import { quizQuestionInputSchema } from '@/lib/validation/question';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';

interface ReportedQuestionEditorProps {
  report: AdminReportViewModel;
}

interface LinkedReportedQuestionEditorProps {
  reportId: string;
  questionId: string;
}

function editableQuestion(question: AdminReportedQuestionViewModel) {
  return question.type === 'single'
    ? {
        question: question.question,
        options: [...question.options],
        type: 'single' as const,
        correctIndex: question.correctIndex ?? 0,
        ...(question.questionImage !== undefined ? { questionImage: question.questionImage } : {}),
        ...(question.optionImages !== undefined
          ? { optionImages: [...question.optionImages] }
          : {}),
      }
    : {
        question: question.question,
        options: [...question.options],
        type: 'multiple' as const,
        correctIndexes: [...(question.correctIndexes ?? [])],
        ...(question.questionImage !== undefined ? { questionImage: question.questionImage } : {}),
        ...(question.optionImages !== undefined
          ? { optionImages: [...question.optionImages] }
          : {}),
      };
}

type EditableQuestion = ReturnType<typeof editableQuestion>;

function createOptionIds(question: AdminReportedQuestionViewModel): string[] {
  return question.options.map(() => `${question.id}-option-${crypto.randomUUID()}`);
}

function replaceOption(
  question: EditableQuestion,
  optionIndex: number,
  value: string,
): EditableQuestion {
  const options = [...question.options];
  options[optionIndex] = value;
  return { ...question, options };
}

function removeOption(question: EditableQuestion, optionIndex: number): EditableQuestion {
  const options = question.options.filter((_, index) => index !== optionIndex);
  const optionImages = question.optionImages?.filter((_, index) => index !== optionIndex);
  const base = {
    question: question.question,
    options,
    ...(question.questionImage !== undefined ? { questionImage: question.questionImage } : {}),
    ...(optionImages?.some(Boolean) ? { optionImages } : {}),
  };

  if (question.type === 'single') {
    const correctIndex =
      question.correctIndex === optionIndex
        ? Math.min(optionIndex, options.length - 1)
        : question.correctIndex > optionIndex
          ? question.correctIndex - 1
          : question.correctIndex;
    return { ...base, type: 'single', correctIndex };
  }

  const correctIndexes = question.correctIndexes.flatMap((index) =>
    index === optionIndex ? [] : [index > optionIndex ? index - 1 : index],
  );
  return { ...base, type: 'multiple', correctIndexes };
}

function LinkedReportedQuestionEditor({ reportId, questionId }: LinkedReportedQuestionEditorProps) {
  const describeError = useAdminApiErrorMessage();
  const [current, setCurrent] = useState<AdminReportedQuestionViewModel | null>(null);
  const [draft, setDraft] = useState<EditableQuestion | null>(null);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetchAdminReportedQuestion(reportId, controller.signal)
      .then((question) => {
        setCurrent(question);
        setDraft(editableQuestion(question));
        setOptionIds(createOptionIds(question));
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(describeError(loadError));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [reportId, questionId, describeError]);

  const dirty = useMemo(() => {
    if (!current || !draft) return false;
    return JSON.stringify(editableQuestion(current)) !== JSON.stringify(draft);
  }, [current, draft]);

  if (loading) {
    return (
      <div className="h-40 animate-pulse rounded-xl border border-[var(--border-default)] bg-neutral-50" />
    );
  }

  if (error || !current || !draft) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error || 'The reported question is unavailable.'}
      </div>
    );
  }

  const save = async () => {
    const parsed = quizQuestionInputSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please check the question fields');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateAdminReportedQuestion({
        reportId,
        question: parsed.data,
      });
      setCurrent(updated);
      setDraft(editableQuestion(updated));
      setOptionIds(createOptionIds(updated));
      setEditing(false);
      toast.success('Question updated');
    } catch (saveError) {
      toast.error(describeError(saveError));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    const correctIndexes =
      current.type === 'single' ? [current.correctIndex ?? 0] : (current.correctIndexes ?? []);
    const optionRows = current.options.map((option, index) => ({
      id: optionIds[index] ?? `${current.id}-option-${option}`,
      index,
      option,
    }));

    return (
      <section className="rounded-xl border border-[var(--border-default)] bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Current question {current.index + 1}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Loaded from the live quiz. The report snapshot is kept unchanged for audit.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <HiOutlinePencil className="mr-1 size-4" />
            Edit question
          </Button>
        </div>
        <QuestionContent content={current.question} className="font-medium text-neutral-950" />
        <div className="mt-3 space-y-2">
          {optionRows.map(({ id, index, option }) => (
            <div
              key={id}
              className={`rounded-lg border px-3 py-2 text-sm ${
                correctIndexes.includes(index)
                  ? 'border-green-200 bg-green-50 text-green-900'
                  : 'border-[var(--border-default)] text-neutral-700'
              }`}
            >
              <span className="mr-2 font-semibold">{String.fromCharCode(65 + index)}.</span>
              <QuestionContent content={option} variant="option" className="inline" />
              {correctIndexes.includes(index) ? (
                <HiOutlineCheck
                  className="ml-2 inline size-4 text-green-700"
                  aria-label="Correct answer"
                />
              ) : null}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-brand-action/30 bg-orange-50/40 p-4">
      <div>
        <label htmlFor={`reported-question-${reportId}`} className="mb-2 block text-sm font-medium">
          Question
        </label>
        <Textarea
          id={`reported-question-${reportId}`}
          rows={4}
          value={draft.question}
          onChange={(event) => setDraft({ ...draft, question: event.target.value })}
        />
        <p className="mt-1 text-xs text-neutral-500">Markdown and math syntax are supported.</p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Question type</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name={`reported-question-type-${reportId}`}
              checked={draft.type === 'single'}
              onChange={() =>
                setDraft({
                  question: draft.question,
                  options: draft.options,
                  type: 'single',
                  correctIndex:
                    draft.type === 'single' ? draft.correctIndex : (draft.correctIndexes[0] ?? 0),
                  ...(draft.questionImage !== undefined
                    ? { questionImage: draft.questionImage }
                    : {}),
                  ...(draft.optionImages !== undefined ? { optionImages: draft.optionImages } : {}),
                })
              }
            />
            Single answer
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name={`reported-question-type-${reportId}`}
              checked={draft.type === 'multiple'}
              onChange={() =>
                setDraft({
                  question: draft.question,
                  options: draft.options,
                  type: 'multiple',
                  correctIndexes:
                    draft.type === 'multiple' ? draft.correctIndexes : [draft.correctIndex],
                  ...(draft.questionImage !== undefined
                    ? { questionImage: draft.questionImage }
                    : {}),
                  ...(draft.optionImages !== undefined ? { optionImages: draft.optionImages } : {}),
                })
              }
            />
            Multiple answers
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Answers</legend>
        {draft.options.map((option, optionIndex) => {
          const optionId = optionIds[optionIndex] ?? `${current.id}-draft-option-${option}`;
          const checked =
            draft.type === 'single'
              ? draft.correctIndex === optionIndex
              : draft.correctIndexes.includes(optionIndex);
          return (
            <div key={optionId} className="flex items-center gap-2">
              <input
                type={draft.type === 'single' ? 'radio' : 'checkbox'}
                name={draft.type === 'single' ? `reported-correct-answer-${reportId}` : undefined}
                aria-label={`Mark answer ${optionIndex + 1} as correct`}
                checked={checked}
                onChange={(event) => {
                  if (draft.type === 'single') {
                    setDraft({ ...draft, correctIndex: optionIndex });
                    return;
                  }
                  setDraft({
                    ...draft,
                    correctIndexes: event.target.checked
                      ? [...draft.correctIndexes, optionIndex].sort((a, b) => a - b)
                      : draft.correctIndexes.filter((index) => index !== optionIndex),
                  });
                }}
              />
              <Input
                value={option}
                onChange={(event) =>
                  setDraft(replaceOption(draft, optionIndex, event.target.value))
                }
                aria-label={`Answer ${optionIndex + 1}`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={draft.options.length <= 2}
                onClick={() => {
                  setDraft(removeOption(draft, optionIndex));
                  setOptionIds((ids) => ids.filter((id) => id !== optionId));
                }}
                aria-label={`Remove answer ${optionIndex + 1}`}
                className="text-neutral-500 hover:text-red-700"
              >
                <HiOutlineTrash className="size-4" />
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={draft.options.length >= 20}
          onClick={() => {
            setDraft({
              ...draft,
              options: [...draft.options, ''],
              ...(draft.optionImages !== undefined
                ? { optionImages: [...draft.optionImages, undefined] }
                : {}),
            });
            setOptionIds((ids) => [...ids, `${current.id}-option-${crypto.randomUUID()}`]);
          }}
        >
          <HiOutlinePlus className="mr-1 size-4" />
          Add answer
        </Button>
      </fieldset>

      {dirty ? (
        <p role="status" className="text-xs font-medium text-amber-700">
          You have unsaved question changes.
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-default)] pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft(editableQuestion(current));
            setOptionIds(createOptionIds(current));
            setEditing(false);
          }}
          disabled={saving}
        >
          Cancel edit
        </Button>
        <Button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          loading={saving}
        >
          Save question
        </Button>
      </div>
    </section>
  );
}

export function ReportedQuestionEditor({ report }: ReportedQuestionEditorProps) {
  if (!report.questionId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This is a legacy quiz-level report. It has no reliable question ID, so inline editing is
        disabled to prevent changing the wrong question.
      </div>
    );
  }

  return (
    <LinkedReportedQuestionEditor
      key={report.id}
      reportId={report.id}
      questionId={report.questionId}
    />
  );
}
