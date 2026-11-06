import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { withAuthCallback } from '@/lib/routing/auth-callback';
import { ROUTES } from '@/shared/constants/routes';
import { TRACKED_QUIZ_ENTRIES } from '@/shared/constants/starter-quiz';

interface PremiumQuizSignInPromptProps {
  slug: string;
  title: string;
  questionCount: number;
  description?: string;
  /** `?entry=` of the visit; a tracked one survives the sign-in round trip (RIN-1000). */
  entry?: string | null;
}

/**
 * What a visitor without a session sees on a Premium quiz (RIN-747): the quiz
 * itself plus a way back to it after signing in. Rendered by the page for
 * guests and by the player when the session expires mid-play (401), so neither
 * path ever shows the server's raw "Unauthorized".
 */
export function PremiumQuizSignInPrompt({
  slug,
  title,
  questionCount,
  description,
  entry,
}: PremiumQuizSignInPromptProps) {
  const t = useTranslations('quiz');
  // next-intl Link hrefs are locale-unprefixed; the auth forms add the locale.
  const tracked = entry && TRACKED_QUIZ_ENTRIES.includes(entry) ? entry : null;
  const quizPath = tracked
    ? `${ROUTES.QUIZ.VIEW(slug)}?entry=${encodeURIComponent(tracked)}`
    : ROUTES.QUIZ.VIEW(slug);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <SurfaceCard className="p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-trust">
          Quiz Premium
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {t('premiumQuestionCount', { count: questionCount })}
        </p>
        {description ? <p className="mt-4 text-sm text-ink">{description}</p> : null}
        <p className="mt-5 rounded-xl bg-brand-trust/5 p-4 text-sm text-ink">
          {t('premiumSignInDescription')}
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={withAuthCallback(ROUTES.LOGIN, quizPath)} className="btn btn-primary">
            {t('premiumSignInButton')}
          </Link>
          <Link href={withAuthCallback(ROUTES.REGISTER, quizPath)} className="btn btn-secondary">
            {t('premiumSignUpButton')}
          </Link>
        </div>
      </SurfaceCard>
    </main>
  );
}
