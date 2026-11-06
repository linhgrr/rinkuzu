'use client';

import { useTranslations } from 'next-intl';
import { HiOutlineDocumentText, HiOutlineLightningBolt } from 'react-icons/hi';
import { Link } from '@/i18n/navigation';
import { Badge, Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { routePathSegment } from '@/lib/routing/routeParams';
import { QUICK_ROUND_SIZE } from '@/shared/constants/quick-round';

export type QuizPlayMode = 'quick' | 'full';

interface QuickRoundChoiceProps {
  slug: string;
  title: string;
  description?: string;
  questionCount: number;
  /** 1-based question of the saved full-quiz progress, or null when there is none. */
  resumeQuestion: number | null;
  onChoose: (mode: QuizPlayMode) => void;
}

const SECONDARY_LINK = 'btn btn-secondary w-full min-h-11 text-center';

/**
 * Start view of a long quiz (RIN-933, Designer spec on RIN-937): a quick round of 10
 * (primary) or the full quiz (secondary). Only the full path can offer to resume.
 */
export function QuickRoundChoice({
  slug,
  title,
  description,
  questionCount,
  resumeQuestion,
  onChoose,
}: QuickRoundChoiceProps) {
  const t = useTranslations('quiz');
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-8">
      <Card
        variant="glass"
        className="w-full max-w-lg border-white/30 shadow-xl backdrop-blur-xl animate-fadeInUp"
      >
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 inline-flex w-fit items-center justify-center rounded-2xl bg-gradient-to-br from-green-500/10 to-accent/10 p-3">
            <HiOutlineDocumentText className="size-6 text-accent" aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-2xl font-semibold text-ink break-words">{title}</h2>
          {description ? <p className="text-ink-muted break-words">{description}</p> : null}
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex justify-center gap-x-8 rounded-xl bg-surface-warm/50 py-4">
              <Badge variant="purple">
                {t('quickRound.questionCount', { count: questionCount })}
              </Badge>
              <Badge variant="info">{t('noTimeLimit')}</Badge>
            </div>
            <div className="space-y-3">
              <Button
                variant="gradient"
                size="lg"
                className="h-auto min-h-12 w-full whitespace-normal bg-brand-action-strong text-white hover:bg-brand-action-strong-hover"
                onClick={() => onChoose('quick')}
              >
                <HiOutlineLightningBolt className="mr-2 size-5 shrink-0" aria-hidden="true" />
                {t('quickRound.start', { count: QUICK_ROUND_SIZE })}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-auto min-h-12 w-full whitespace-normal"
                onClick={() => onChoose('full')}
              >
                {t('quickRound.full', { count: questionCount })}
              </Button>
              {resumeQuestion !== null ? (
                <p className="text-center text-sm text-ink-muted">
                  {t('quickRound.resumeHint', { question: resumeQuestion })}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/" className={SECONDARY_LINK}>
                {t('backHome')}
              </Link>
              <Link href={`/quiz/${routePathSegment(slug)}/flashcards`} className={SECONDARY_LINK}>
                {t('flashcards')}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
