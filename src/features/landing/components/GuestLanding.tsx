import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import HeroSection from './new-landing/HeroSection';
import { Features as FeatureSection } from './new-landing/Features';
import { HowItWorks as HowItWorksSection } from './new-landing/HowItWorks';
import { FAQ as FaqSection } from './new-landing/FAQ';

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

interface GuestLandingProps {
  quizzes: Quiz[];
  isAuthenticated?: boolean;
}

export function GuestLanding({ quizzes, isAuthenticated = false }: GuestLandingProps) {
  const t = useTranslations('landing');

  return (
    <div
      className="min-h-screen bg-[#07121a]"
      style={
        {
          '--hero-heading-gradient':
            'linear-gradient(144.5deg, #ffffff 28%, rgba(0, 0, 0, 0) 115%)',
        } as CSSProperties
      }
    >
      <main>
        <HeroSection isAuthenticated={isAuthenticated} />
        <FeatureSection />
        <HowItWorksSection />
        <section id="quizzes" className="bg-[var(--bg-section)] py-24 md:py-32">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-3xl mb-16">
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[var(--text-primary)] mb-4">
                {t('featured_quizzes')}
              </h2>
              <p className="text-[var(--text-muted)] text-lg md:text-xl font-medium">
                {t('featured_quizzes_description')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {quizzes.map((quiz) => (
                <Link
                  key={quiz._id}
                  href={`/quiz/${quiz.slug}`}
                  className="group block rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex flex-col h-full">
                    <span
                      className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 w-fit"
                      style={{
                        backgroundColor: `${quiz.category.color}15`,
                        color: quiz.category.color,
                      }}
                    >
                      {quiz.category.name}
                    </span>
                    <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-3 group-hover:text-brand-trust transition-colors">
                      {quiz.title}
                    </h3>
                    <p className="text-[var(--text-muted)] text-sm line-clamp-2 mb-6 flex-grow">
                      {quiz.description}
                    </p>
                    <div className="flex items-center text-brand-trust font-semibold text-sm">
                      {t('start_quiz')}
                      <svg
                        className="ml-1 size-4 transition-transform group-hover:translate-x-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <FaqSection />
        <section className="bg-[#07121a] py-24 md:py-32">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-8">
              {t('ready_to_start')}
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/adaptive"
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 font-semibold text-black hover:bg-neutral-100 transition-colors duration-200 text-lg"
              >
                {t('get_started_free')}
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full border border-neutral-700 bg-transparent px-8 py-4 font-semibold text-white hover:bg-neutral-800 transition-colors duration-200 text-lg"
              >
                {t('view_pricing')}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
