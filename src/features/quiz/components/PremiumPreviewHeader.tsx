import { useTranslations } from 'next-intl';

interface PremiumPreviewHeaderProps {
  title: string;
  /** Question the learner is on, 1-based. */
  position: number;
  /** Questions the learner can play: the preview size, or the whole quiz. */
  playable: number;
  /** Questions in the full quiz; only a preview of a longer quiz shows the marker (RIN-1722). */
  fullQuestionCount: number | null;
}

/**
 * Header of the Premium player: eyebrow, title, counter. A preview of a longer quiz adds the
 * "Preview" pill and one free-preview note; the counter always reads `n/playable`, so it never
 * promises a question the learner cannot reach.
 */
export function PremiumPreviewHeader({
  title,
  position,
  playable,
  fullQuestionCount,
}: PremiumPreviewHeaderProps) {
  const t = useTranslations('quiz');
  const isPreview = fullQuestionCount !== null && fullQuestionCount > playable;
  return (
    <header className="relative z-50 mb-6 flex items-end justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-trust">
            Quiz Premium
          </p>
          {isPreview ? (
            <span className="rounded-full bg-brand-trust/10 px-2 py-0.5 text-xs font-semibold text-brand-trust">
              {t('premiumPreviewBadge')}
            </span>
          ) : null}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{title}</h1>
        {isPreview ? (
          <p className="mt-2 text-sm text-ink-muted">
            {t('premiumPreviewNote', { shown: playable, total: fullQuestionCount })}
          </p>
        ) : null}
      </div>
      <span className="text-sm text-ink-muted">
        {position}/{playable}
      </span>
    </header>
  );
}
