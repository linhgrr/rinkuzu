'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { QuizTextLimitState } from '@/features/guest-draft/lib/quiz-text-limit';
import { cn } from '@/lib/utils';
import { QUIZ_TEXT_MAX_CHARS, QUIZ_TEXT_MIN_CHARS } from '@/shared/constants/quiz-text-source';

interface QuizTextFieldProps {
  value: string;
  onChange: (text: string) => void;
  /** From `quizTextLimitState(value)`; the caller needs it too, to enable its button. */
  limit: QuizTextLimitState;
  /** Id of the hint, so the submit button can point at the reason it is disabled. */
  hintId: string;
  readOnly: boolean;
}

/**
 * Pasted-text field shared by `/try/text` and the signed-in `/create/text` (RIN-1539,
 * RIN-1542): label, textarea, hint and live counter. Never `maxLength`: a paste over the
 * limit is shown and explained, not silently cut.
 */
export function QuizTextField({ value, onChange, limit, hintId, readOnly }: QuizTextFieldProps) {
  const t = useTranslations('guestDraft.text');
  const textareaId = useId();
  const over = limit.kind === 'over';
  const hint =
    limit.kind === 'short'
      ? t('hintShort', { min: QUIZ_TEXT_MIN_CHARS, missing: limit.missing })
      : over
        ? t('hintLong', { max: QUIZ_TEXT_MAX_CHARS, over: limit.over })
        : '';
  return (
    <div className="space-y-2">
      <label htmlFor={textareaId} className="block text-sm font-medium text-neutral-950">
        {t('label')}
      </label>
      <textarea
        id={textareaId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        placeholder={t('placeholder')}
        aria-invalid={over || undefined}
        aria-describedby={hintId}
        className={cn(
          'input !h-auto min-h-56 w-full resize-y break-words p-3 text-base text-ink placeholder:text-ink-muted sm:min-h-72',
          over && 'border-red-500',
          readOnly && 'bg-neutral-50',
        )}
      />
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
        <p id={hintId} role="status" className={over ? 'text-red-600' : 'text-neutral-600'}>
          {hint}
        </p>
        <p
          aria-live="off"
          data-testid="guest-text-counter"
          className={cn(
            'ml-auto tabular-nums',
            over ? 'font-medium text-red-600' : 'text-neutral-500',
          )}
        >
          {t('counter', { count: limit.count, max: QUIZ_TEXT_MAX_CHARS })}
        </p>
      </div>
    </div>
  );
}
