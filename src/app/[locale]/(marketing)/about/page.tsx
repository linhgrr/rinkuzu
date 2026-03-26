import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { buildLocalizedMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { siteUrl } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/about',
    title: 'About RinKuzu — Our Mission to Make Learning Adaptive',
    description:
      'RinKuzu is an AI-powered adaptive learning platform built by educators and engineers. Learn about our mission to transform how students master any subject using knowledge graphs and Bloom\'s Taxonomy.',
  });
}

const teamSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About RinKuzu',
  url: `${siteUrl.origin}/about`,
  description:
    'RinKuzu is an AI-powered adaptive learning platform that transforms PDF documents into personalized quiz-based learning journeys.',
  mainEntity: {
    '@type': 'Organization',
    name: 'RinKuzu',
    url: siteUrl.origin,
    description: 'AI-powered adaptive learning platform for students, teachers, and training teams.',
    areaServed: 'Worldwide',
    knowsAbout: [
      'Adaptive Learning',
      'Artificial Intelligence',
      'Educational Technology',
      'Knowledge Graphs',
      "Bloom's Taxonomy",
    ],
  },
};

const values = [
  {
    icon: '🧠',
    title: 'Adaptive by Design',
    body: 'Every learner is unique. RinKuzu uses Bayesian Knowledge Tracing to model each student\'s mastery and continuously adapts the learning path to target weak spots.',
  },
  {
    icon: '📄',
    title: 'PDF-First',
    body: 'Your existing materials are the best study guides. Upload any lecture PDF and our AI extracts and structures the knowledge — no manual question writing needed.',
  },
  {
    icon: '🔗',
    title: 'Knowledge Graphs',
    body: 'We visualize prerequisite relationships between concepts so learners understand not just what to study, but why concepts build on each other.',
  },
  {
    icon: '🎯',
    title: 'Bloom\'s Taxonomy',
    body: 'Practice spans all six cognitive levels — from basic recall to creative synthesis — ensuring deep mastery rather than surface-level recognition.',
  },
];

const stats = [
  { value: '2024', label: 'Founded' },
  { value: 'AI-Powered', label: 'Core Technology' },
  { value: '2', label: 'Languages' },
  { value: '100%', label: 'Student-First' },
];

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;

  return (
    <main className="min-h-screen bg-white">
      {/* JSON-LD */}
      <JsonLd id="about-schema" data={teamSchema} />

      {/* Hero */}
      <section className="bg-[#fbfbfd] py-20 md:py-32 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase text-teal-600 mb-4">Our Story</p>
          <h1 className="text-4xl md:text-6xl font-bold text-[#1e242c] mb-6 leading-tight">
            Learning Should Adapt to You,<br />Not the Other Way Around
          </h1>
          <p className="text-lg text-[#414d60] leading-relaxed max-w-2xl mx-auto">
            RinKuzu was built by educators and engineers who believe that great learning tools should meet students where they are — using AI to understand each learner&apos;s knowledge state and craft a personalized path forward.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold tracking-widest uppercase text-teal-600 mb-3">Our Mission</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e242c] mb-6 leading-tight">
              Turning Static PDFs Into Dynamic Learning Journeys
            </h2>
            <p className="text-[#414d60] leading-relaxed mb-4">
              Most students have a folder of lecture notes, textbooks, and handouts — all the material they need to master a subject, but no structured way to practice it effectively.
            </p>
            <p className="text-[#414d60] leading-relaxed mb-4">
              RinKuzu bridges that gap. Upload a PDF and our AI does the work of an expert instructor: extracting key concepts, identifying what knowledge is required before other knowledge can be understood, and generating practice questions that target exactly where you need growth.
            </p>
            <p className="text-[#414d60] leading-relaxed">
              The result is a learning experience that adapts to your pace, your strengths, and your gaps — turning any document into a personalized curriculum.
            </p>
          </div>
          {/* Visual */}
          <div className="relative">
            <div className="rounded-3xl overflow-hidden shadow-[10px_25px_100px_0px_rgba(0,43,107,0.12)]">
              <Image
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80"
                alt="Students studying together with RinKuzu on laptop"
                width={600}
                height={450}
                className="w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-lg px-6 py-4 border border-gray-100">
              <p className="text-2xl font-bold text-[#1e242c]">PDF → Knowledge</p>
              <p className="text-sm text-[#414d60]">AI-powered in seconds</p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-24 bg-[#fbfbfd]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold tracking-widest uppercase text-teal-600 mb-3">What We Stand For</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e242c]">Our Core Principles</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {values.map((v) => (
              <div key={v.title} className="rounded-3xl bg-white border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4">{v.icon}</div>
                <h3 className="text-xl font-bold text-[#1e242c] mb-3">{v.title}</h3>
                <p className="text-[#414d60] leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 md:py-20 bg-[#1d1d1f] text-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-3xl md:text-4xl font-bold text-white mb-1">{s.value}</p>
                <p className="text-sm text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          {/* Visual */}
          <div className="relative order-2 md:order-1">
            <div className="rounded-3xl overflow-hidden shadow-[10px_25px_100px_0px_rgba(0,43,107,0.12)]">
              <Image
                src="https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80"
                alt="AI-powered adaptive learning knowledge graph visualization"
                width={600}
                height={400}
                className="w-full object-cover"
              />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <p className="text-sm font-semibold tracking-widest uppercase text-teal-600 mb-3">Built on Research</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e242c] mb-6 leading-tight">
              Grounded in Learning Science
            </h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-bold text-[#1e242c] mb-1">Bayesian Knowledge Tracing (BKT)</h3>
                <p className="text-[#414d60] text-sm leading-relaxed">
                  RinKuzu models the probability you&apos;ve mastered each concept using BKT — the same framework used in intelligent tutoring systems. Every practice response updates your mastery estimate in real time.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-[#1e242c] mb-1">Bloom&apos;s Taxonomy (1956)</h3>
                <p className="text-[#414d60] text-sm leading-relaxed">
                  Our question generation targets all six cognitive levels. This ensures learners develop both foundational recall and higher-order thinking — the combination that leads to lasting retention.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-[#1e242c] mb-1">Knowledge Graphs</h3>
                <p className="text-[#414d60] text-sm leading-relaxed">
                  By modeling concepts as nodes and prerequisite relationships as edges, RinKuzu can recommend what to study next with full awareness of what knowledge must come first.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-[#fbfbfd]">
        <div className="max-w-2xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1e242c]">Ready to Start Learning?</h2>
          <p className="text-[#414d60] text-lg">
            Join thousands of students and teachers who are mastering subjects faster with RinKuzu.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-[#1d1d1f] text-white font-semibold px-8 py-3.5 hover:bg-[#2d2d2f] transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/adaptive-learning"
              className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white text-[#1e242c] font-semibold px-8 py-3.5 hover:bg-gray-50 transition-colors"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
