'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { HiOutlineDotsVertical, HiOutlineLockClosed } from 'react-icons/hi';
import { Skeleton } from '@/components/ui/Skeleton';
import { UserAvatar } from '@/components/user/UserAvatar';
import type { UserIdentity } from '@/components/user/user-identity';
import { ROUTES } from '@/shared/constants/routes';

export interface QuizCardQuiz {
  title: string;
  slug: string;
  author: UserIdentity | null;
  visibility: 'public' | 'personal';
  questionCount: number;
  premiumSubmissionStatus?: 'pending' | 'changes_requested' | 'rejected' | 'approved';
  awardedCredits?: number;
}

interface QuizCardProps {
  quiz: QuizCardQuiz;
  quizId: string;
  onDelete?: (quiz: QuizCardQuiz, quizId: string) => void;
}

function getAuthor(quiz: QuizCardQuiz): UserIdentity {
  if (!quiz.author) return { displayName: 'RinKuzu learner' };
  return quiz.author;
}

export function QuizCard({ quiz, quizId, onDelete }: QuizCardProps) {
  const t = useTranslations('profile');
  const author = getAuthor(quiz);

  return (
    <article className="group relative flex min-h-[146px] flex-col rounded-xl border border-secondary-2 bg-surface-blue p-4 shadow-quiz-card transition-shadow duration-150 ease-out hover:shadow-quiz-card-active focus-within:shadow-quiz-card-active motion-reduce:transition-none">
      <div className="flex items-center justify-between text-sm text-ink/40">
        <div className="flex flex-wrap items-center gap-2">
          <span>{t('questionCount', { count: quiz.questionCount })}</span>
          {quiz.premiumSubmissionStatus ? (
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-ink/65">
              {t(`premiumStatus_${quiz.premiumSubmissionStatus}`)}
              {quiz.premiumSubmissionStatus === 'approved' && quiz.awardedCredits
                ? ` · +${quiz.awardedCredits}`
                : ''}
            </span>
          ) : null}
        </div>
        {onDelete ? (
          <details className="relative">
            <summary
              className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-ink/55 opacity-70 transition-[color,background-color,opacity] hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100 group-focus-within:opacity-100"
              aria-label={t('quizActions')}
            >
              <HiOutlineDotsVertical className="size-5" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-line bg-white py-1 text-sm text-ink shadow-lg">
              <Link
                href={`/edit/${quizId}`}
                className="flex min-h-11 items-center px-3 py-2 hover:bg-surface-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                {t('edit')}
              </Link>
              <button
                type="button"
                onClick={() => onDelete(quiz, quizId)}
                className="flex min-h-11 w-full items-center px-3 py-2 text-left text-error hover:bg-error-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-error"
              >
                {t('deleteQuiz')}
              </button>
            </div>
          </details>
        ) : null}
      </div>

      <Link
        href={ROUTES.QUIZ.VIEW(quiz.slug)}
        className="mt-2 flex flex-1 flex-col rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <h3 className="line-clamp-2 font-home text-body font-semibold text-ink">{quiz.title}</h3>
        <div className="mt-auto flex items-center gap-2 pt-3 text-sm text-ink">
          <UserAvatar user={author} size={26} />
          <span className="min-w-0 truncate">
            {author.displayName || author.name || 'RinKuzu learner'}
          </span>
          {quiz.visibility === 'personal' ? (
            <HiOutlineLockClosed
              className="ml-auto size-4 shrink-0 text-ink/45"
              aria-label={t('personalSource')}
            />
          ) : null}
        </div>
      </Link>
    </article>
  );
}

export function QuizCardSkeleton() {
  return (
    <Skeleton className="flex min-h-[146px] flex-col rounded-xl border border-secondary-2 bg-surface-blue p-4 shadow-quiz-card">
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 rounded bg-line-blue/30" />
        <div className="size-7 rounded-md bg-line-blue/25" />
      </div>
      <div className="mt-3 h-5 w-4/5 rounded bg-line-blue/30" />
      <div className="mt-2 h-5 w-3/5 rounded bg-line-blue/25" />
      <div className="mt-auto flex items-center gap-2 pt-3">
        <div className="size-[26px] rounded-full bg-line-blue/30" />
        <div className="h-4 w-28 rounded bg-line-blue/25" />
      </div>
    </Skeleton>
  );
}
