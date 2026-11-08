import { HiOutlineChevronRight } from 'react-icons/hi';
import { Link } from '@/i18n/navigation';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type {
  DashboardHomeCopy,
  DashboardStarterViewModel,
} from '@/features/dashboard/types/dashboard-view-model';

interface StarterQuizBlockProps {
  starter: DashboardStarterViewModel;
  copy: DashboardHomeCopy['starter'];
}

/** First-run block for a learner with no attempt and no quiz yet: one short public quiz, no upload. */
export function StarterQuizBlock({ starter, copy }: StarterQuizBlockProps) {
  const { primary, alternatives } = starter;

  return (
    <SurfaceCard
      className="flex flex-col gap-4 border-accent p-4 sm:p-5"
      aria-label={copy.title}
      data-testid="starter-quiz-block"
    >
      <SectionHeading title={copy.title} subtitle={copy.subtitle} />
      <Link
        href={primary.href}
        className="flex flex-col gap-3 rounded-xl bg-hero p-4 text-ink transition-colors hover:bg-accent-soft sm:flex-row sm:items-center sm:justify-between"
        data-testid="starter-quiz-primary"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="line-clamp-2 font-home text-base font-semibold leading-snug">
            {primary.title}
          </span>
          <span className="font-home text-sm leading-snug">
            {copy.questionCount(primary.questionCount)}
          </span>
        </span>
        <span className="inline-flex w-fit shrink-0 rounded-full bg-brand-action px-5 py-2.5 font-home text-base font-semibold leading-snug text-brand-action-text">
          {copy.start}
        </span>
      </Link>
      {alternatives.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="font-home text-sm font-semibold leading-snug text-ink">
            {copy.alternativesLabel}
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {alternatives.map((quiz) => (
              <li key={quiz.slug}>
                <Link
                  href={quiz.href}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 font-home text-sm text-ink hover:border-accent"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="line-clamp-1 font-semibold">{quiz.title}</span>
                    <span>{copy.questionCount(quiz.questionCount)}</span>
                  </span>
                  <HiOutlineChevronRight className="size-5 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SurfaceCard>
  );
}
