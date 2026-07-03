'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { HiOutlineDotsVertical, HiOutlineLockClosed } from 'react-icons/hi';
import { Skeleton } from '@/components/ui/Skeleton';
import { UserAvatar } from '@/components/user/UserAvatar';
import type { UserIdentity } from '@/components/user/user-identity';

export interface QuizCardQuiz {
  title: string;
  slug: string;
  author: UserIdentity | null;
  isPrivate: boolean;
  questionCount: number;
}

interface QuizCardProps {
  quiz: QuizCardQuiz;
  quizId: string;
  locale: string;
  onDelete?: (quiz: QuizCardQuiz, quizId: string) => void;
}

function getAuthor(quiz: QuizCardQuiz): UserIdentity {
  if (!quiz.author) return { displayName: 'RinKuzu learner' };
  return quiz.author;
}

export function QuizCard({ quiz, quizId, locale, onDelete }: QuizCardProps) {
  const t = useTranslations('profile');
  const author = getAuthor(quiz);

  return (
    <article className="group relative flex min-h-[146px] flex-col rounded-xl border border-[#e2ecfc] bg-surface-blue p-4 shadow-[1px_1px_4px_rgba(0,0,0,0.03)] transition-shadow duration-150 ease-out hover:shadow-[2px_2px_0_#718ebd] focus-within:shadow-[2px_2px_0_#718ebd] motion-reduce:transition-none">
      <div className="flex items-center justify-between text-sm text-ink/40">
        <span>{t('questionCount', { count: quiz.questionCount })}</span>
        {onDelete ? (
          <details className="relative">
            <summary
              className="flex size-7 cursor-pointer list-none items-center justify-center rounded-md text-ink/55 opacity-70 transition-[color,background-color,opacity] hover:bg-accent-soft hover:text-accent group-hover:opacity-100 group-focus-within:opacity-100"
              aria-label={t('quizActions')}
            >
              <HiOutlineDotsVertical className="size-5" />
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-line bg-white py-1 text-sm text-ink shadow-lg">
              <Link href={`/edit/${quizId}`} className="block px-3 py-2 hover:bg-surface-warm">
                {t('edit')}
              </Link>
              <button
                type="button"
                onClick={() => onDelete(quiz, quizId)}
                className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
              >
                {t('deleteQuiz')}
              </button>
            </div>
          </details>
        ) : null}
      </div>

      <Link href={`/${locale}/quiz/${quiz.slug}`} className="mt-2 flex flex-1 flex-col">
        <h3 className="line-clamp-2 font-home text-base font-semibold leading-[1.4] text-ink">
          {quiz.title}
        </h3>
        <div className="mt-auto flex items-center gap-2 pt-3 text-sm text-ink">
          <UserAvatar user={author} size={26} />
          <span className="min-w-0 truncate">
            {author.displayName || author.name || author.email || 'RinKuzu learner'}
          </span>
          {quiz.isPrivate ? (
            <HiOutlineLockClosed
              className="ml-auto size-4 shrink-0 text-ink/45"
              aria-label={t('private')}
            />
          ) : null}
        </div>
      </Link>
    </article>
  );
}

export function QuizCardSkeleton() {
  return (
    <Skeleton className="flex min-h-[146px] flex-col rounded-xl border border-line-blue/30 bg-surface-blue p-4">
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
