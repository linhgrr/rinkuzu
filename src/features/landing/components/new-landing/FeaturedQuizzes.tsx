'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Reveal, RevealStagger, RevealItem } from './motion-primitives';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  slug: string;
  category: {
    name: string;
    color: string;
  };
}

export function FeaturedQuizzes({ quizzes }: { quizzes: Quiz[] }) {
  const t = useTranslations('landing');

  return (
    <section id="quizzes" className="bg-[#0d0d0d] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-16 max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
            {t('featured_quizzes')}
          </h2>
          <p className="mt-4 text-lg text-white/60">{t('featured_quizzes_description')}</p>
        </Reveal>

        <RevealStagger className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => (
            <RevealItem key={quiz._id}>
              <Link
                href={`/quiz/${quiz.slug}`}
                className="group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-green-500/30 hover:bg-white/[0.07]"
              >
                <span className="mb-4 w-fit rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/70">
                  {quiz.category.name}
                </span>
                <h3 className="mb-3 text-xl font-semibold text-white transition-colors group-hover:text-green-400">
                  {quiz.title}
                </h3>
                <p className="mb-6 line-clamp-2 flex-grow text-sm text-white/55">
                  {quiz.description}
                </p>
                <div className="flex items-center text-sm font-semibold text-green-400">
                  {t('start_quiz')}
                  <ArrowRight
                    className="ml-1 size-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
