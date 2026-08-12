'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { ButtonBase } from '@/components/ui/ButtonBase';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { toStableContentEntries } from '@/lib/collections/stable-content-entries';
import { Modal } from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { HiCheck, HiOutlineEye, HiOutlineX } from 'react-icons/hi';
import {
  buildExercisePromptText,
  getExercisePromptSections,
} from '@/features/adaptive/lib/exercise-prompt';
import { BLOOM_LABELS } from '@/features/adaptive/types/learning';
import type { ExerciseHistoryFull } from '@/features/adaptive/types/history';
import type { BloomLevel } from '@/features/adaptive/types/learning';
import { formatSessionHistoryDate } from '@/features/adaptive/lib/session-history-utils';

const PAGE_SIZE = 10;
const BLOOM_TRANSLATION_KEYS: Record<BloomLevel, `bloom.${Lowercase<BloomLevel>}`> = {
  Remember: 'bloom.remember',
  Understand: 'bloom.understand',
  Apply: 'bloom.apply',
  Analyze: 'bloom.analyze',
  Evaluate: 'bloom.evaluate',
  Create: 'bloom.create',
};

interface ExerciseHistoryTableProps {
  exercises: ExerciseHistoryFull[];
}

type AdaptiveLearningTranslate = ReturnType<typeof useTranslations<'adaptiveLearning'>>;

interface ExercisePromptViewProps {
  exercise: ExerciseHistoryFull;
}

interface AnswerTextViewProps {
  value: string | null | undefined;
  t: AdaptiveLearningTranslate;
}

interface CorrectAnswerViewProps {
  exercise: ExerciseHistoryFull;
  t: AdaptiveLearningTranslate;
}

interface SelectedChoicesSummaryProps {
  exercise: ExerciseHistoryFull;
  t: AdaptiveLearningTranslate;
}

interface SelectedOptionsListProps {
  exercise: ExerciseHistoryFull;
  t: AdaptiveLearningTranslate;
}

function ExercisePromptView({ exercise }: ExercisePromptViewProps) {
  const promptSections = getExercisePromptSections(exercise);
  return (
    <div className="space-y-3">
      {promptSections.lead ? <MarkdownRenderer content={promptSections.lead} /> : null}
      <div className={promptSections.lead ? 'rounded-lg border border-line bg-neutral-50 p-3' : ''}>
        <MarkdownRenderer content={promptSections.primary} />
      </div>
    </div>
  );
}

function AnswerTextView({ value, t }: AnswerTextViewProps) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return <span>{t('history.table.noAnswer')}</span>;
  }

  if (normalizedValue === 'True') {
    return <span>{t('exercise.interactions.trueLabel')}</span>;
  }

  if (normalizedValue === 'False') {
    return <span>{t('exercise.interactions.falseLabel')}</span>;
  }

  return <MarkdownRenderer content={normalizedValue} />;
}

function getSelectedChoiceKeys(userAnswer: string | null | undefined) {
  return new Set(
    (userAnswer ?? '').split(',').flatMap((choice) => {
      const normalizedChoice = choice.trim().toUpperCase();
      return normalizedChoice ? [normalizedChoice] : [];
    }),
  );
}

function CorrectAnswerView({ exercise, t }: CorrectAnswerViewProps) {
  if (exercise.exercise_type === 'matching' && exercise.pairs?.length) {
    return (
      <div className="space-y-2">
        {exercise.pairs.map((pair) => (
          <div
            key={`${pair.left}-${pair.right}`}
            className="flex items-center justify-between rounded-lg border border-green-100 bg-white p-2"
          >
            <div className="min-w-0 flex-1 text-xs text-neutral-600">
              <MarkdownRenderer content={pair.left} />
            </div>
            <div className="mx-2 text-green-500">→</div>
            <div className="min-w-0 flex-1 text-right text-xs font-semibold text-green-700">
              <MarkdownRenderer content={pair.right} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (exercise.exercise_type === 'ordering' && Array.isArray(exercise.correct_answer)) {
    return (
      <div className="flex flex-wrap gap-2">
        {exercise.correct_answer.map((item, idx) => (
          <div
            key={item}
            className="flex items-center gap-2 rounded-lg border border-green-100 bg-white p-2 text-xs"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-green-100 font-mono text-xs font-bold text-green-700">
              {idx + 1}
            </span>
            <div className="min-w-0 text-neutral-700">
              <MarkdownRenderer content={item} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (exercise.exercise_type === 'fill_blank' && Array.isArray(exercise.correct_answer)) {
    return (
      <div className="space-y-1">
        {toStableContentEntries(exercise.correct_answer).map(({ content: answer, key }) => (
          <MarkdownRenderer key={key} content={answer} variant="answer" />
        ))}
      </div>
    );
  }

  if (exercise.exercise_type === 'multi_correct' && Array.isArray(exercise.correct_answer)) {
    return (
      <div className="space-y-1">
        {toStableContentEntries(exercise.correct_answer).map(({ content: answer, key }) => (
          <MarkdownRenderer key={key} content={answer} variant="answer" />
        ))}
      </div>
    );
  }

  if (exercise.exercise_type === 'true_false' && typeof exercise.correct_answer === 'boolean') {
    return (
      <span>
        {exercise.correct_answer
          ? t('exercise.interactions.trueLabel')
          : t('exercise.interactions.falseLabel')}
      </span>
    );
  }

  return <MarkdownRenderer content={exercise.correct_option} />;
}

function SelectedChoicesSummary({ exercise, t }: SelectedChoicesSummaryProps) {
  const selectedChoices = Array.from(getSelectedChoiceKeys(exercise.user_answer));

  if (!selectedChoices.length) {
    return <span>{t('history.table.noAnswer')}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {selectedChoices.map((choice) => {
        const optionValue = exercise.options?.[choice];
        return (
          <div
            key={choice}
            className="inline-flex items-center gap-2 rounded-md border border-line bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700"
          >
            <span className="font-mono font-semibold text-neutral-500">{choice}</span>
            {optionValue ? <MarkdownRenderer content={optionValue} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function SelectedOptionsList({ exercise, t }: SelectedOptionsListProps) {
  const selectedChoices = getSelectedChoiceKeys(exercise.user_answer);
  const correctAnswerSet =
    exercise.exercise_type === 'multi_correct' && Array.isArray(exercise.correct_answer)
      ? new Set(exercise.correct_answer)
      : null;

  return (
    <div className="space-y-2.5">
      {Object.entries(exercise.options || {}).map(([key, value]) => {
        const isUserAnswer = selectedChoices.has(key);
        const isCorrect =
          exercise.exercise_type === 'multi_correct'
            ? Boolean(correctAnswerSet?.has(key))
            : key === exercise.correct_option;

        const optionClass = isCorrect
          ? 'border-green-200 bg-green-50/50 text-green-900'
          : isUserAnswer
            ? 'border-red-200 bg-red-50/50 text-red-900'
            : 'border-line bg-white text-neutral-700';

        const badgeTone = isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

        return (
          <div
            key={key}
            className={`flex items-start gap-3 rounded-lg border p-3.5 text-sm transition-colors ${optionClass}`}
          >
            <span
              className={`mt-0.5 w-6 shrink-0 font-bold ${isCorrect ? 'text-green-700' : isUserAnswer ? 'text-red-700' : 'text-neutral-500'}`}
            >
              {key}.
            </span>
            <span className="flex-1 leading-relaxed">
              <MarkdownRenderer content={value} />
            </span>
            {isCorrect ? (
              <div
                className={`mt-0.5 flex shrink-0 items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold ${badgeTone}`}
              >
                <HiCheck className="size-3.5" />
                {t('history.table.correctBadge')}
              </div>
            ) : null}
            {isUserAnswer && !isCorrect ? (
              <div
                className={`mt-0.5 flex shrink-0 items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold ${badgeTone}`}
              >
                <HiOutlineX className="size-3.5" />
                {t('history.table.yourAnswerBadge')}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function ExerciseHistoryTable({ exercises }: ExerciseHistoryTableProps) {
  const t = useTranslations('adaptiveLearning');
  const locale = useLocale();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseHistoryFull | null>(null);

  const getBloomLabel = (level: number) => {
    const bloomLabel =
      BLOOM_LABELS[Math.max(0, Math.min(BLOOM_LABELS.length - 1, level - 1))] || 'Remember';
    return t(BLOOM_TRANSLATION_KEYS[bloomLabel]);
  };

  const start = (currentPage - 1) * PAGE_SIZE;
  const paginatedExercises = exercises.slice(start, start + PAGE_SIZE);

  const totalPages = Math.ceil(exercises.length / PAGE_SIZE);

  if (!exercises.length) {
    return (
      <p className="py-4 text-center text-sm text-neutral-400">{t('history.table.noExercise')}</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-neutral-50 text-xs font-bold uppercase tracking-widest text-neutral-500">
              <th className="px-5 py-3 text-left">#</th>
              <th className="px-5 py-3 text-left">{t('masteryMatrix.concept')}</th>
              <th className="px-5 py-3 text-left">{t('history.table.bloom')}</th>
              <th className="w-1/3 px-5 py-3 text-left">{t('history.table.question')}</th>
              <th className="px-5 py-3 text-center">{t('history.table.result')}</th>
              <th className="px-5 py-3 text-left">{t('history.table.time')}</th>
              <th className="px-5 py-3 text-center">
                <span className="sr-only">{t('history.table.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {paginatedExercises.map((exercise, index) => (
              <tr key={exercise.exercise_id} className="transition-colors hover:bg-neutral-50">
                <td className="px-5 py-3 font-mono text-xs text-neutral-500">
                  {(currentPage - 1) * PAGE_SIZE + index + 1}
                </td>
                <td className="px-5 py-3 font-medium text-neutral-900">{exercise.concept_name}</td>
                <td className="px-5 py-3 text-xs text-neutral-500">
                  <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
                    {getBloomLabel(exercise.bloom_level)}
                  </span>
                </td>
                <td
                  className="max-w-70 px-5 py-3 text-neutral-600"
                  title={buildExercisePromptText(exercise)}
                >
                  <div className="line-clamp-2 text-sm [&_p]:m-0 [&_p]:inline">
                    <MarkdownRenderer content={buildExercisePromptText(exercise)} />
                  </div>
                </td>
                <td className="flex justify-center px-5 py-3">
                  {exercise.is_correct == null ? (
                    <span className="font-medium text-neutral-300">N/A</span>
                  ) : exercise.is_correct ? (
                    <span
                      role="img"
                      aria-label={t('correct')}
                      className="inline-flex size-6 items-center justify-center rounded border border-line bg-white text-neutral-900"
                    >
                      <HiCheck className="size-4" aria-hidden="true" />
                    </span>
                  ) : (
                    <span
                      role="img"
                      aria-label={t('incorrect')}
                      className="inline-flex size-6 items-center justify-center rounded border border-line bg-neutral-50 text-neutral-400"
                    >
                      <HiOutlineX className="size-4" aria-hidden="true" />
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-neutral-500">
                  {formatSessionHistoryDate(exercise.timestamp, locale)}
                </td>
                <td className="px-5 py-3 text-center">
                  <ButtonBase
                    type="button"
                    onClick={() => setSelectedExercise(exercise)}
                    className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                    title={t('history.table.viewDetails')}
                    aria-label={t('history.table.viewDetails')}
                  >
                    <HiOutlineEye className="size-5" />
                  </ButtonBase>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="py-2">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      ) : null}

      <Modal
        isOpen={!!selectedExercise}
        onClose={() => setSelectedExercise(null)}
        title={t('history.table.exerciseDetails')}
        size="large"
      >
        {selectedExercise ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-line/50 bg-neutral-50 p-4 text-sm">
              <div>
                <span className="font-medium text-neutral-500">{t('masteryMatrix.concept')}:</span>
                <span className="ml-2 font-semibold text-neutral-900">
                  {selectedExercise.concept_name}
                </span>
              </div>
              <div>
                <span className="font-medium text-neutral-500">
                  {t('history.table.bloomLevel')}:
                </span>
                <span className="ml-2 font-semibold text-neutral-900">
                  {getBloomLabel(selectedExercise.bloom_level)}
                </span>
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold text-neutral-900">
                {t('history.table.question')}
              </h4>
              <div className="rounded-lg border border-line bg-white p-4 text-sm text-neutral-800 shadow-sm">
                <ExercisePromptView exercise={selectedExercise} />
              </div>
            </div>

            {Object.keys(selectedExercise.options || {}).length > 0 ? (
              <div className="space-y-3">
                <h4 className="mb-3 text-sm font-semibold text-neutral-900">
                  {t('history.table.options')}
                </h4>
                <SelectedOptionsList exercise={selectedExercise} t={t} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-line bg-white p-4 text-sm text-neutral-800 shadow-sm">
                    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
                      {t('history.table.yourAnswerCard')}
                    </div>
                    <SelectedChoicesSummary exercise={selectedExercise} t={t} />
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 text-sm text-green-900 shadow-sm">
                    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-green-700">
                      {t('history.table.correctAnswerCard')}
                    </div>
                    <CorrectAnswerView exercise={selectedExercise} t={t} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-line bg-white p-4 text-sm text-neutral-800 shadow-sm">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
                    {t('history.table.yourAnswerCard')}
                  </div>
                  <div>
                    <AnswerTextView value={selectedExercise.user_answer} t={t} />
                  </div>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 text-sm text-green-900 shadow-sm">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-green-700">
                    {t('history.table.correctAnswerCard')}
                  </div>
                  <CorrectAnswerView exercise={selectedExercise} t={t} />
                </div>
              </div>
            )}

            {selectedExercise.exercise_type === 'short_answer' &&
            selectedExercise.rubric?.length ? (
              <div>
                <h4 className="mb-3 text-sm font-semibold text-neutral-900">
                  {t('history.table.rubric')}
                </h4>
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950 shadow-sm">
                  <ul className="space-y-2">
                    {selectedExercise.rubric.map((criterion, index) => (
                      <li key={criterion} className="flex gap-2">
                        <span className="font-mono text-xs text-amber-700">{index + 1}.</span>
                        <span className="flex-1">
                          <MarkdownRenderer content={criterion} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {selectedExercise.explanation ? (
              <div>
                <h4 className="mb-3 text-sm font-semibold text-neutral-900">
                  {t('history.table.explanation')}
                </h4>
                <div className="rounded-lg border border-line bg-neutral-50 p-5 text-sm leading-relaxed text-neutral-800 shadow-sm sm:p-6">
                  <MarkdownRenderer content={selectedExercise.explanation} />
                </div>
              </div>
            ) : null}

            <div className="flex justify-end border-t border-line/50 pt-5">
              <Button onClick={() => setSelectedExercise(null)} variant="outline" className="px-6">
                {t('common.close')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
