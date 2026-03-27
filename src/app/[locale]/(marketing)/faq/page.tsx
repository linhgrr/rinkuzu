import type { Metadata } from 'next';
import Link from 'next/link';
import { buildLocalizedMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildFaqSchema } from '@/lib/structured-data';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/faq',
    title: 'FAQ | RinKuzu',
    description:
      'Frequently asked questions about RinKuzu — AI quiz generator, adaptive learning, knowledge graphs, Bloom\'s Taxonomy, and how to use RinKuzu for students and teachers.',
    robots: { index: true, follow: true },
  });
}

const FAQ_CATEGORIES = [
  { id: 'getting-started', label: 'Getting Started', faqs: ['1', '2', '3', '4'] },
  { id: 'ai-features', label: 'AI & Adaptive Learning', faqs: ['5', '6', '7', '13'] },
  { id: 'platform', label: 'Platform & Technical', faqs: ['8', '9', '10', '11'] },
  { id: 'privacy-teachers', label: 'Privacy & Educators', faqs: ['12', '14', '15'] },
];

const FAQ_INTRO = `Whether you're a student preparing for exams, a teacher building assessments, or a professional upskilling — RinKuzu is designed to make learning faster, smarter, and more personal. This FAQ covers everything from how our AI generates quizzes from PDFs to how we protect your data and support educators in the classroom.

Not finding what you're looking for? Email us at support@rinkuzu.com and our team will get back to you within 24–48 hours.`;

const faqs = [
  {
    q: 'What is RinKuzu?',
    a: 'RinKuzu is an AI-powered adaptive learning platform that transforms PDF documents into personalized quiz-based learning journeys. Using knowledge graphs and Bloom\'s Taxonomy, it helps students, teachers, and training teams master any subject at their own pace. Our system uses SAINT-Bloom knowledge tracing and Dueling DQN reinforcement learning to continuously adapt to each learner\'s progress.',
  },
  {
    q: 'How do I generate a quiz from a PDF?',
    a: 'Simply upload any PDF document — lecture notes, textbooks, or internal docs — and RinKuzu\'s AI will automatically extract key concepts, identify prerequisite relationships, and generate high-quality quizzes with explanations. No manual question writing required. The process takes under a minute for most documents.',
  },
  {
    q: 'Is RinKuzu free to use?',
    a: 'Yes, RinKuzu offers a free plan with core features including PDF-to-quiz generation, adaptive practice, mastery tracking, and community quiz browsing. A Premium plan is available for users who need advanced features and priority support. See our pricing page for full details.',
  },
  {
    q: 'Which languages does RinKuzu support?',
    a: 'RinKuzu currently supports Vietnamese and English. The platform is fully bilingual, and you can switch languages using the language switcher in the navigation. AI-generated content (quizzes and explanations) adapts to the language of your uploaded PDF.',
  },
  {
    q: 'What is a knowledge graph in learning?',
    a: 'A knowledge graph maps the relationships between concepts in your study material. RinKuzu analyzes your PDF and builds a visual graph showing which concepts are prerequisites for others, helping you understand the learning path from fundamentals to advanced topics. This ensures you never practice a concept before mastering its prerequisites.',
  },
  {
    q: 'What is Bloom\'s Taxonomy and how does RinKuzu use it?',
    a: 'Bloom\'s Taxonomy is a framework for classifying educational objectives across six cognitive levels: Remember, Understand, Apply, Analyze, Evaluate, and Create. RinKuzu generates quizzes at each level to ensure deep mastery, starting from basic recall and progressing to higher-order reasoning. This prevents the common problem of students who score well on recall but fail at application.',
  },
  {
    q: 'How does adaptive learning work on RinKuzu?',
    a: 'RinKuzu tracks your performance on each concept using Bayesian Knowledge Tracing (BKT). The AI prioritizes questions on concepts where you\'re weakest, adjusting difficulty and content dynamically so every practice session is optimized for your learning needs. Your session is driven by a Dueling DQN reinforcement learning agent that selects the next best (concept, difficulty) pair.',
  },
  {
    q: 'Can I share my quizzes with others?',
    a: 'Yes! You can set your quiz sets to public to share with friends, classmates, or the wider RinKuzu community. Browse the Explore page to discover quizzes created by other users on a wide range of topics. Private quizzes remain accessible only to you.',
  },
  {
    q: 'What types of questions does RinKuzu generate?',
    a: 'RinKuzu generates multiple-choice questions at all six Bloom\'s Taxonomy levels. Each question comes with an explanation that references the source material in your PDF, helping you understand not just the answer but why it\'s correct. Questions are generated by Google Gemini AI and evaluated by the same model for instant feedback.',
  },
  {
    q: 'Does RinKuzu work on mobile devices?',
    a: 'Yes, RinKuzu is a Progressive Web App (PWA) that works on desktop, tablet, and mobile browsers. You can install it on your device for an app-like experience with offline access to your progress and saved quizzes. The adaptive practice engine works across all screen sizes.',
  },
  {
    q: 'What file formats are supported?',
    a: 'Currently, RinKuzu accepts PDF documents. Support for other formats (Word docs, PowerPoint slides, plain text) is on our roadmap. We recommend using text-based PDFs (not scanned image PDFs) for the best quiz generation quality.',
  },
  {
    q: 'How is my data and privacy protected?',
    a: 'All uploaded PDFs are processed securely. Your documents and quiz data are private by default. We never use your uploaded content to train AI models. See our full Privacy Policy for details on GDPR compliance, Vietnamese PDPA compliance, and our data retention practices.',
  },
  {
    q: 'What is the AI tutor Rin-chan?',
    a: 'Rin-chan is RinKuzu\'s built-in AI tutor. It can explain any concept from your uploaded PDF in plain language, answer follow-up questions, and guide you through difficult topics. Rin-chan is available 24/7 within the app and provides personalized explanations based on your current mastery level.',
  },
  {
    q: 'How do I track my learning progress?',
    a: 'The Dashboard shows your mastery level per concept, accuracy trends over time, weak topics, and completion rates. You can review your history and bookmark quizzes for later practice. The knowledge graph visualization shows which concepts you\'ve mastered and which still need work.',
  },
  {
    q: 'Can teachers use RinKuzu for classroom assessment?',
    a: 'Absolutely. Teachers can upload their lecture PDFs to generate quizzes for students, track class-wide performance, and identify concepts that need re-teaching. RinKuzu is a powerful tool for formative assessment and exam preparation. Contact us at support@rinkuzu.com for educator pricing and bulk access.',
  },
];

export default async function FAQPage({ params }: Props) {
  const { locale } = await params;

  // Strip HTML tags from answers for plain-text schema
  const plainFaqs = faqs.map((f) => ({
    q: f.q,
    a: f.a.replace(/<[^>]+>/g, ''),
  }));
  const plainFaqSchema = buildFaqSchema(plainFaqs);

  return (
    <main className="min-h-screen bg-white">
      {/* FAQ JSON-LD */}
      <JsonLd id="faq-schema" data={plainFaqSchema} />

      {/* Hero */}
      <section className="bg-[#fbfbfd] py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold text-[#1d1d1f] mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-[#86868b] text-lg">
            Everything you need to know about RinKuzu — AI-powered adaptive learning from PDFs.
          </p>
        </div>
      </section>

      {/* FAQ Categories + Intro */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        {/* Intro paragraph */}
        <div className="prose prose-slate max-w-none mb-16 text-[#414d60] leading-relaxed">
          {FAQ_INTRO.split('\n\n').map((para, i) => (
            <p key={i} className="mb-4 text-base md:text-lg">{para}</p>
          ))}
        </div>

        {/* Category Navigation */}
        <div className="flex flex-wrap gap-3 mb-12">
          {FAQ_CATEGORIES.map((cat) => (
            <a
              key={cat.id}
              href={`#${cat.id}`}
              className="px-4 py-2 rounded-full bg-gray-100 text-sm font-medium text-[#414d60] hover:bg-teal-50 hover:text-teal-700 transition-colors"
            >
              {cat.label}
            </a>
          ))}
        </div>

        {/* Category sections with anchor IDs */}
        {FAQ_CATEGORIES.map((cat) => (
          <div key={cat.id} id={cat.id} className="mb-16">
            <h2 className="text-xl font-bold text-[#1e242c] mb-6 pb-3 border-b border-gray-100">
              {cat.label}
            </h2>
            <div className="space-y-4">
              {cat.faqs.map((num) => {
                const faq = faqs[parseInt(num) - 1];
                if (!faq) return null;
                return (
                  <div key={num} className="bg-gray-50 rounded-2xl p-6">
                    <h3 className="font-semibold text-[#1e242c] mb-2">{faq.q}</h3>
                    <p className="text-[#414d60] leading-relaxed">{faq.a}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="bg-[#1d1d1f] text-white py-16 text-center">
        <div className="max-w-xl mx-auto px-6 space-y-4">
          <h2 className="text-2xl font-semibold">Still have questions?</h2>
          <p className="text-gray-400">
            Our AI tutor Rin-chan is available 24/7. Or reach us at{' '}
            <a href="mailto:support@rinkuzu.com" className="underline hover:text-white">
              support@rinkuzu.com
            </a>
            .
          </p>
          <Link
            href="/register"
            className="inline-block bg-white text-[#1d1d1f] font-semibold px-8 py-3 rounded-full hover:bg-gray-100 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </main>
  );
}
