import type { CSSProperties } from 'react';
import Link from 'next/link';
import { HeroSection } from './new-landing';
import { JsonLd } from '@/components/seo/JsonLd';
import { siteUrl } from '@/lib/seo';

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
    url: siteUrl.origin,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
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
      <JsonLd id="home-software-schema" data={softwareSchema} />
      <main>
        <HeroSection />
        <section className="bg-[#fbfbfd] text-[#1d1d1f]">
          <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 space-y-24">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">How RinKuzu Works</h2>
              <p className="text-[#86868b] text-[19px] leading-[1.6] md:text-xl font-medium">
                RinKuzu is an AI quiz generator built for students, teachers, and training teams who want to turn
                static materials into structured learning. Instead of manually writing hundreds of questions, you upload
                a PDF once and the platform extracts key concepts, identifies prerequisite relationships, and creates
                quiz sessions that match your current level.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <article className="rounded-3xl border border-gray-200 bg-white p-10 space-y-6 shadow-sm transition-transform hover:shadow-md duration-500">
                <h3 className="text-2xl font-semibold tracking-tight">Upload PDFs and Generate AI Quizzes</h3>
                <p className="text-[#86868b] text-[17px] leading-[1.6]">
                  Start by uploading lecture notes, textbooks, or internal docs. RinKuzu analyzes your file and
                  generates high-quality quizzes with explanations. Use this for exam preparation, classroom
                  review, onboarding, and skill reinforcement. The generated quiz structure supports both quick practice
                  and deeper concept checks so learning is measurable over time.
                </p>
              </article>
              <article className="rounded-3xl border border-gray-200 bg-white p-10 space-y-6 shadow-sm transition-transform hover:shadow-md duration-500">
                <h3 className="text-2xl font-semibold tracking-tight">Knowledge Graph & Adaptive Practice</h3>
                <p className="text-[#86868b] text-[17px] leading-[1.6]">
                  RinKuzu builds a knowledge graph from your content and uses it to decide what to ask next. This helps
                  learners move from fundamentals to advanced topics. Combined with adaptive
                  practice, the platform prioritizes weak concepts and adjusts question difficulty, making every session
                  focused and efficient.
                </p>
              </article>
            </div>

            <div className="space-y-12">
              <h2 className="text-center text-3xl md:text-4xl font-semibold tracking-tight">Features for Real Learning</h2>
              <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                <article className="rounded-3xl bg-white border border-gray-200 p-8 shadow-sm">
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">AI Quiz Maker</h3>
                  <p className="text-[#86868b] text-[15px] leading-relaxed">
                    Build quizzes from existing documents in minutes and save preparation time for teachers and course
                    creators.
                  </p>
                </article>
                <article className="rounded-3xl bg-white border border-gray-200 p-8 shadow-sm">
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">Mastery Tracking</h3>
                  <p className="text-[#86868b] text-[15px] leading-relaxed">
                    Track accuracy, weak topics, and completion trends so learners know exactly what to improve next.
                  </p>
                </article>
                <article className="rounded-3xl bg-white border border-gray-200 p-8 shadow-sm">
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">Bloom-Level Paths</h3>
                  <p className="text-[#86868b] text-[15px] leading-relaxed">
                    Practice from recall to higher-order reasoning with a sequence designed for long-term retention.
                  </p>
                </article>
              </div>
            </div>

            <div className="max-w-4xl mx-auto text-center space-y-8 rounded-3xl bg-[#1d1d1f] text-white p-12 md:p-16">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Why Teams Choose RinKuzu</h2>
              <p className="text-gray-400 text-[17px] md:text-[19px] leading-[1.6] max-w-3xl mx-auto font-medium">
                Traditional tools stop at generation. RinKuzu combines AI quiz generation, knowledge graphs,
                and adaptive recommendation in one product. Better learner guidance, cleaner content reuse,
                and faster iteration for educators.
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-6">
                <Link
                  href="/adaptive-learning"
                  className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 font-semibold text-[#1d1d1f] hover:bg-gray-100 transition-colors duration-200"
                >
                  Try AI Quiz Generator
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-full border border-gray-700 bg-transparent px-8 py-3.5 font-semibold text-white hover:bg-gray-800 transition-colors duration-200"
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
