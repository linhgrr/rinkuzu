import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  HeroSection,
  FeatureSection,
  HowItWorksSection,
  FaqSection,
} from './new-landing';

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
  const t = useTranslations('Landing');

  return (
    <div
      className="min-h-screen bg-black"
      style={
        {
          '--hero-heading-gradient': 'linear-gradient(144.5deg, #ffffff 28%, rgba(0, 0, 0, 0) 115%)',
        } as CSSProperties
      }
    >
      <main>
        <HeroSection isAuthenticated={isAuthenticated} />
        <FeatureSection />
        <HowItWorksSection />
        <section id="quizzes" className="bg-[#fbfbfd] py-24 md:py-32">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-3xl mb-16">
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f] mb-4">
                {t('featured_quizzes')}
              </h2>
              <p className="text-[#86868b] text-lg md:text-xl font-medium">
                {t('featured_quizzes_description')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {quizzes.map((quiz) => (
                <Link
                  key={quiz._id}
                  href={`/quiz/${quiz.slug}`}
                  className="group block rounded-3xl bg-white border border-gray-200 p-8 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1"
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
                    <h3 className="text-xl font-semibold text-[#1d1d1f] mb-3 group-hover:text-[#0071e3] transition-colors">
                      {quiz.title}
                    </h3>
                    <p className="text-[#86868b] text-sm line-clamp-2 mb-6 flex-grow">
                      {quiz.description}
                    </p>
                    <div className="flex items-center text-[#0071e3] font-semibold text-sm">
                      {t('start_quiz')}
                      <svg
                        className="ml-1 w-4 h-4 transition-transform group-hover:translate-x-1"
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
        <section className="bg-black py-24 md:py-32">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-8">
              {t('ready_to_start')}
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/adaptive-learning"
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 font-semibold text-black hover:bg-gray-100 transition-colors duration-200 text-lg"
              >
                {t('get_started_free')}
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full border border-gray-700 bg-transparent px-8 py-4 font-semibold text-white hover:bg-gray-800 transition-colors duration-200 text-lg"
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
