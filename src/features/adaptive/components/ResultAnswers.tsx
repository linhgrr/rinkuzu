'use client';

import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { toStableContentEntries } from '@/lib/collections/stable-content-entries';
import { HiArrowRight } from 'react-icons/hi';
import type { ExerciseAnswerDraft } from '@/features/adaptive/types/exercise-answer';
import type { SubmitResult, Exercise, TranslateFn } from '@/features/adaptive/types/learning';

function normalizeMathContent(content: string): string {
  if (!content) return content;

  return content.replace(
    /\t(?=(imes|ext|frac|sqrt|cdot|vec|left|right|mathrm|mathbf|mathit|alpha|beta|gamma|delta|theta|lambda|mu|pi|rho|sigma|phi|omega|Delta))/g,
    '\\t',
  );
}

/** One lettered option: "A." plus the option text, so the learner never has to scroll back (RIN-1011). */
function ResultOptionLine({ exercise, optionKey }: { exercise: Exercise; optionKey: string }) {
  const text = exercise.options[optionKey];
  if (text === undefined) {
    return <MarkdownRenderer content={normalizeMathContent(optionKey)} />;
  }
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 font-mono font-bold">{optionKey}.</span>
      <div className="min-w-0 flex-1">
        <MarkdownRenderer content={normalizeMathContent(text)} />
      </div>
    </div>
  );
}

function ResultOptionList({ exercise, optionKeys }: { exercise: Exercise; optionKeys: string[] }) {
  return (
    <div className="space-y-1">
      {optionKeys.map((optionKey) => (
        <ResultOptionLine key={optionKey} exercise={exercise} optionKey={optionKey} />
      ))}
    </div>
  );
}

function ResultPairList({ pairs }: { pairs: { left: string; right: string }[] }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {pairs.map((pair) => (
        <div
          key={`${pair.left}-${pair.right}`}
          className="flex items-center justify-between rounded-lg border border-line bg-white p-2"
        >
          <div className="min-w-0 flex-1 text-xs text-neutral-600">
            <MarkdownRenderer content={normalizeMathContent(pair.left)} />
          </div>
          <HiArrowRight className="size-3 text-neutral-400" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-right text-xs font-semibold text-neutral-800">
            <MarkdownRenderer content={normalizeMathContent(pair.right)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultOrderedList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <div
          key={item}
          className="flex items-center gap-2 rounded-lg border border-line bg-white p-2 text-xs"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-neutral-100 font-mono text-xs font-bold text-neutral-700">
            {idx + 1}
          </span>
          <div className="min-w-0 font-medium text-neutral-700">
            <MarkdownRenderer content={normalizeMathContent(item)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function booleanLabel(value: boolean, t: TranslateFn): string {
  return value ? t('exercise.interactions.trueLabel') : t('exercise.interactions.falseLabel');
}

export function ResultCorrectAnswer({
  exercise,
  result,
  t,
}: {
  exercise: Exercise;
  result: SubmitResult;
  t: TranslateFn;
}) {
  if (exercise.exercise_type === 'matching') {
    return <ResultPairList pairs={exercise.pairs} />;
  }

  if (exercise.exercise_type === 'ordering' && Array.isArray(exercise.correct_answer)) {
    return <ResultOrderedList items={exercise.correct_answer} />;
  }

  if (exercise.exercise_type === 'fill_blank' && Array.isArray(exercise.correct_answer)) {
    return (
      <div className="space-y-1">
        {toStableContentEntries(exercise.correct_answer).map(({ content: answer, key }) => (
          <MarkdownRenderer key={key} content={normalizeMathContent(answer)} variant="answer" />
        ))}
      </div>
    );
  }

  if (exercise.exercise_type === 'multi_correct' && Array.isArray(exercise.correct_answer)) {
    return <ResultOptionList exercise={exercise} optionKeys={exercise.correct_answer} />;
  }

  if (exercise.exercise_type === 'true_false' && typeof exercise.correct_answer === 'boolean') {
    return <span>{booleanLabel(exercise.correct_answer, t)}</span>;
  }

  if (exercise.exercise_type === 'mcq') {
    return <ResultOptionLine exercise={exercise} optionKey={result.correct_option} />;
  }

  return <MarkdownRenderer content={normalizeMathContent(result.correct_option)} />;
}

function ResultLearnerAnswerBody({
  answer,
  exercise,
  t,
}: {
  answer: ExerciseAnswerDraft;
  exercise: Exercise;
  t: TranslateFn;
}) {
  switch (answer.type) {
    case 'mcq':
      return answer.selection === null ? null : (
        <ResultOptionLine exercise={exercise} optionKey={answer.selection} />
      );
    case 'multi_correct':
      return <ResultOptionList exercise={exercise} optionKeys={answer.selections} />;
    case 'true_false':
      return answer.value === null ? null : <span>{booleanLabel(answer.value, t)}</span>;
    case 'fill_blank':
      return <MarkdownRenderer content={normalizeMathContent(answer.values[0])} />;
    case 'short_answer':
      return <p className="whitespace-pre-wrap">{answer.text}</p>;
    case 'ordering':
      return <ResultOrderedList items={answer.items} />;
    case 'matching':
      return (
        <ResultPairList
          pairs={Object.entries(answer.matches).map(([left, right]) => ({ left, right }))}
        />
      );
    default:
      return null;
  }
}

/** The learner's own answer next to the correct one, shown only when they got it wrong. */
export function ResultLearnerAnswer({
  answer,
  exercise,
  isCorrect,
  t,
}: {
  answer: ExerciseAnswerDraft | null;
  exercise: Exercise;
  isCorrect: boolean;
  t: TranslateFn;
}) {
  if (isCorrect || !answer || answer.type !== exercise.exercise_type) return null;

  return (
    <div
      className="rounded-xl border border-line bg-neutral-50 p-5"
      data-testid="result-learner-answer"
    >
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-500">
        {t('result.yourAnswerLabel')}
      </span>
      <div className="text-sm font-medium text-neutral-700">
        <ResultLearnerAnswerBody answer={answer} exercise={exercise} t={t} />
      </div>
    </div>
  );
}
