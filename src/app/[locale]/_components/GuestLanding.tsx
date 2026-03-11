import type { CSSProperties } from 'react';
import Link from 'next/link';
import { HeroSection } from './new-landing';

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
}

export function GuestLanding({ quizzes }: GuestLandingProps) {
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'RinKuzu',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    description: 'AI quiz generator from PDFs with knowledge graph learning and adaptive practice.',
    url: 'https://quizz-ck.vercel.app',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'RinKuzu',
    url: 'https://quizz-ck.vercel.app',
    logo: 'https://quizz-ck.vercel.app/icons/icon-512x512.png',
    sameAs: [
      'https://twitter.com',
      'https://facebook.com',
      'https://linkedin.com',
      'https://instagram.com',
    ],
  };

  return (
    <div
      className="min-h-screen bg-black"
      style={
        {
          '--hero-heading-gradient': 'linear-gradient(144.5deg, #ffffff 28%, rgba(0, 0, 0, 0) 115%)',
        } as CSSProperties
      }
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <main>
        <HeroSection />
        <section className="bg-white text-slate-900">
          <div className="max-w-6xl mx-auto px-6 py-16 space-y-14">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">How RinKuzu Works</h2>
              <p className="text-slate-600 leading-7">
                RinKuzu is an AI quiz generator built for students, teachers, and training teams who want to turn
                static materials into structured learning. Instead of manually writing hundreds of questions, you upload
                a PDF once and the platform extracts key concepts, identifies prerequisite relationships, and creates
                quiz sessions that match your current level. This approach combines a practical quiz generator from PDF
                workflow with adaptive learning logic, so each learner receives relevant practice instead of random
                question sets.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <article className="rounded-xl border border-slate-200 p-6 space-y-3">
                <h3 className="text-xl font-semibold">Upload PDFs and Generate AI Quizzes</h3>
                <p className="text-slate-600 leading-7">
                  Start by uploading lecture notes, textbooks, or internal docs. RinKuzu analyzes your file and
                  generates high-quality quizzes with explanations. You can use this for exam preparation, classroom
                  review, onboarding, and skill reinforcement. The generated quiz structure supports both quick practice
                  and deeper concept checks so learning is measurable over time.
                </p>
              </article>
              <article className="rounded-xl border border-slate-200 p-6 space-y-3">
                <h3 className="text-xl font-semibold">Knowledge Graph Learning and Adaptive Practice</h3>
                <p className="text-slate-600 leading-7">
                  RinKuzu builds a knowledge graph from your content and uses it to decide what to ask next. This helps
                  learners move from fundamentals to advanced topics in the right order. Combined with adaptive
                  practice, the platform prioritizes weak concepts and adjusts question difficulty, making every session
                  focused and efficient.
                </p>
              </article>
            </div>

            <div className="space-y-5">
              <h2 className="text-3xl font-bold">Features for Real Learning Outcomes</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <article className="rounded-xl bg-slate-50 p-5">
                  <h3 className="font-semibold mb-2">AI Quiz Maker from PDF</h3>
                  <p className="text-slate-600 text-sm leading-6">
                    Build quizzes from existing documents in minutes and save preparation time for teachers and course
                    creators.
                  </p>
                </article>
                <article className="rounded-xl bg-slate-50 p-5">
                  <h3 className="font-semibold mb-2">Progress and Mastery Tracking</h3>
                  <p className="text-slate-600 text-sm leading-6">
                    Track accuracy, weak topics, and completion trends so learners know exactly what to improve next.
                  </p>
                </article>
                <article className="rounded-xl bg-slate-50 p-5">
                  <h3 className="font-semibold mb-2">Bloom-Level Learning Paths</h3>
                  <p className="text-slate-600 text-sm leading-6">
                    Practice from recall to higher-order reasoning with a sequence designed for long-term retention.
                  </p>
                </article>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-bold">Why Teams Choose RinKuzu</h2>
              <p className="text-slate-600 leading-7">
                Traditional quiz tools stop at question generation. RinKuzu combines AI quiz generation, knowledge graph
                learning, and adaptive recommendation in one product. That means better learner guidance, cleaner
                content reuse, and faster iteration for educators. If you are looking for an AI learning platform that
                can generate quiz content from PDFs and still provide personalized progression, RinKuzu is built for
                that workflow.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/adaptive-learning"
                  className="inline-flex items-center rounded-lg bg-violet-600 px-5 py-2.5 font-medium text-white hover:bg-violet-700"
                >
                  Try AI Quiz Generator
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  View Pricing
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
