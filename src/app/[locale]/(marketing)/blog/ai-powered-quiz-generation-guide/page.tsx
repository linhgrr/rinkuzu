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
    path: '/blog/ai-powered-quiz-generation-guide',
    title: 'How AI Transforms PDF Learning into Adaptive Quizzes | RinKuzu',
    description:
      'Discover how large language models extract concepts from lecture PDFs and generate personalized quiz questions that adapt to each learner\'s mastery level using knowledge graphs and Bloom\'s Taxonomy.',
  });
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  name: 'How AI Transforms PDF Learning into Adaptive Quizzes',
  headline: 'How AI Transforms PDF Learning into Adaptive Quizzes',
  description:
    'Discover how large language models extract concepts from lecture PDFs and generate personalized quiz questions that adapt to each learner\'s mastery level.',
  url: `${siteUrl.origin}/blog/ai-powered-quiz-generation-guide`,
  datePublished: '2026-03-27',
  dateModified: '2026-03-27',
  author: {
    '@type': 'Organization',
    name: 'RinKuzu Team',
    url: `${siteUrl.origin}/about`,
  },
  publisher: {
    '@type': 'Organization',
    name: 'RinKuzu',
    url: siteUrl.origin,
    logo: `${siteUrl.origin}/icons/icon-512x512.png`,
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    url: `${siteUrl.origin}/blog/ai-powered-quiz-generation-guide`,
  },
};

const sections = [
  {
    id: 'the-problem',
    heading: 'The Problem with Traditional Study Materials',
    body: `Every student has a folder of lecture notes, course textbooks, and reference materials — rich content that contains the knowledge they need to master a subject. Yet most of that material sits passive, read once and forgotten. The challenge isn't access to information; it's that static documents can't adapt to the reader. A 300-page textbook treats every student the same way, whether they're seeing the material for the first time or reviewing for an exam.

Research in cognitive science consistently shows that spaced repetition, active recall, and adaptive difficulty are among the most effective learning strategies. But applying these strategies manually requires significant expertise and time — time most students and teachers simply don't have.`,
  },
  {
    id: 'how-ai-extracts',
    heading: 'How AI Extracts Concepts from PDFs',
    body: `Large language models (LLMs) have transformed how we can process written material. When RinKuzu analyzes a PDF, the AI doesn't just read the text — it identifies the conceptual structure underneath. It recognizes definitions, theorems, examples, cause-and-effect relationships, comparisons, and procedures.

This process involves several steps:

**Concept Identification.** The AI scans for key terms, definitions, and topic headers to build a list of discrete concepts present in the document.

**Relationship Mapping.** Using the document's structure — chapter ordering, section hierarchies, cross-references — the AI infers which concepts are likely prerequisites for others. A chapter on "Derivatives" in a calculus textbook is almost certainly a prerequisite for a chapter on "Integration."

**Difficulty Estimation.** The AI assesses concept complexity based on factors like: abstractness of definitions, density of prerequisites, use of technical notation, and length of explanatory sections.

The output is a structured concept map that captures not just what topics exist in the document, but how they relate to each other.`,
  },
  {
    id: 'adaptive-questions',
    heading: 'From Concepts to Adaptive Questions',
    body: `Having extracted a concept map, the next challenge is generating questions that genuinely test understanding — not just recognition memory. This is where Bloom's Taxonomy becomes critical.

**Bloom's Taxonomy** (Benjamin Bloom, 1956; Anderson & Krathwohl, 2001) classifies cognitive processes across six levels:

1. **Remember** — Recall definitions, facts, formulas
2. **Understand** — Explain concepts in your own words
3. **Apply** — Use knowledge in new situations
4. **Analyze** — Break down relationships and structures
5. **Evaluate** — Judge quality using criteria
6. **Create** — Combine elements into new patterns

RinKuzu generates questions across all six levels. A Remember-level question might ask: "What is the derivative of x²?" An Apply-level question might present a novel physics scenario requiring the student to derive the correct formula. A Create-level prompt might ask the student to design an experiment that tests the concept.

This matters because students who only practice Remember-level questions develop the illusion of mastery. True understanding only emerges when you can apply, analyze, and synthesize.`,
  },
  {
    id: 'bayesian-mastery',
    heading: 'Tracking Mastery with Bayesian Knowledge Tracing',
    body: `How does RinKuzu know what to ask next? The answer lies in **Bayesian Knowledge Tracing (BKT)**, a probabilistic model originally developed for intelligent tutoring systems.

BKT maintains a probability estimate for each learner's mastery of every concept. Each time you answer a question, BKT updates this probability:

**If you answer correctly:** Mastery probability increases, with the size of the increase depending on the question's difficulty and the prior probability. Correct answers on harder questions produce larger jumps.

**If you answer incorrectly:** Mastery probability decreases, again scaled by difficulty.

Over time, BKT builds a precise picture of each learner's knowledge state. RinKuzu's recommendation engine then uses this model to select the next concept to practice — prioritizing those where:

- Mastery is low
- The concept has no unresolved prerequisites
- The learner hasn't practiced recently (spaced repetition)

This produces a learning path that is genuinely personalized: different for every student, adapting in real time.`,
  },
  {
    id: 'knowledge-graphs',
    heading: 'Knowledge Graphs: The Structural Foundation',
    body: `A knowledge graph represents concepts as nodes and prerequisite relationships as directed edges. In a calculus knowledge graph, "Limits" → "Derivatives" → "Integrals" → "Differential Equations" would form a chain where mastering later concepts requires mastery of earlier ones.

This structure enables two critical capabilities:

**Prerequisite-Aware Recommendations.** RinKuzu will never recommend practicing "Integration" before a learner's "Derivatives" mastery is sufficient. This prevents the frustration of being asked questions you can't answer because you're missing foundational knowledge.

**Gap Analysis.** The knowledge graph makes it easy to identify where a learner's understanding breaks down. If someone consistently fails questions about "Integration by Parts," the graph reveals whether the problem is the integration technique itself or a gap in the prerequisite chain (perhaps "Derivatives of Trigonometric Functions" wasn't fully mastered).

When you upload a PDF, RinKuzu builds this graph automatically from the document's structure and content — no manual curriculum design required.`,
  },
  {
    id: 'real-results',
    heading: 'What This Means in Practice',
    body: `Traditional flashcard systems and quiz banks treat every concept equally and at fixed intervals. RinKuzu's approach produces measurably different outcomes:

- **Faster mastery**: By prioritizing weak concepts, study time is concentrated where it has the greatest impact. Students practicing with adaptive recommendation systems typically show 20–30% faster skill acquisition compared to fixed-schedule review.
- **Better retention**: Spaced repetition built into BKT ensures concepts are revisited at optimal intervals — just before they're likely to be forgotten, not after.
- **Deeper understanding**: Practice spanning all six Bloom's levels develops conceptual understanding, not just recall. Students can transfer knowledge to new problems, not just recognize answers they\'ve seen before.
- **Personalized pacing**: Every learner moves at their own optimal speed. Strong prerequisites let a fast learner skip ahead; persistent gaps slow the pace and add practice.

The AI doesn't replace the teacher — it handles the repetitive work of question generation, scheduling, and progress tracking, freeing educators to focus on insight, motivation, and the human elements of learning.`,
  },
  {
    id: 'get-started',
    heading: 'Get Started with AI-Powered Learning',
    body: `RinKuzu puts all of this into practice in a single workflow: upload a PDF, get an adaptive quiz session. No curriculum design, no question banking, no scheduling — just your materials and an AI that understands how you learn.

The free plan includes full PDF-to-quiz generation, knowledge graph visualization, adaptive practice across all Bloom's levels, and mastery tracking. Start with your next lecture PDF and see what a truly adaptive learning session feels like.`,
  },
];

export default async function BlogPost({ params }: Props) {
  const { locale } = await params;

  return (
    <article className="min-h-screen bg-white">
      <JsonLd id="article-schema" data={articleSchema} />

      {/* Hero */}
      <header className="bg-[#fbfbfd] border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-12">
          <nav className="flex items-center gap-2 text-sm text-[#414d60] mb-8">
            <Link href="/" className="hover:text-[#1e242c] transition-colors">Home</Link>
            <span>/</span>
            <Link href="/blog/ai-powered-quiz-generation-guide" className="hover:text-[#1e242c] transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-[#1e242c]">AI & PDFs</span>
          </nav>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
              AI in Education
            </span>
            <span className="text-xs text-[#414d60]">March 27, 2026 · 8 min read</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-[#1e242c] leading-tight mb-6">
            How AI Transforms PDF Learning into Adaptive Quizzes
          </h1>
          <p className="text-lg text-[#414d60] leading-relaxed">
            Discover how large language models extract concepts from lecture PDFs and generate personalized quiz questions that adapt to each learner's mastery level.
          </p>
          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-200">
            <div className="w-10 h-10 rounded-full bg-[#1d1d1f] flex items-center justify-center text-white font-bold text-sm">RK</div>
            <div>
              <p className="text-sm font-semibold text-[#1e242c]">RinKuzu Team</p>
              <p className="text-xs text-[#414d60]">RinKuzu · AI Learning Platform</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero image */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-3xl overflow-hidden shadow-[10px_25px_100px_0px_rgba(0,43,107,0.10)]">
          <Image
            src="https://images.unsplash.com/photo-1589998059171-988d887df646?w=1200&q=80"
            alt="Open textbook with highlighted notes beside a laptop showing an AI learning interface"
            width={900}
            height={500}
            className="w-full object-cover"
            priority
          />
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 pb-20">
        <div className="prose prose-slate max-w-none">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="mb-12">
              <h2 className="text-2xl font-bold text-[#1e242c] mb-4">{s.heading}</h2>
              {s.body.split('\n\n').map((para, i) => {
                if (para.startsWith('**') && para.endsWith('**')) {
                  return (
                    <p key={i} className="text-[#414d60] leading-relaxed mb-3">
                      <strong className="text-[#1e242c]">{para.replace(/\*\*/g, '')}</strong>
                    </p>
                  );
                }
                if (para.startsWith('**')) {
                  return (
                    <p key={i} className="text-[#414d60] leading-relaxed mb-3">
                      {para.split('**').map((part, j) =>
                        j % 2 === 1 ? <strong key={j} className="text-[#1e242c]">{part}</strong> : part
                      )}
                    </p>
                  );
                }
                if (para.match(/^\d+\./)) {
                  // numbered list
                  return (
                    <p key={i} className="text-[#414d60] leading-relaxed mb-3 pl-4 border-l-2 border-gray-100">
                      {para.replace(/^\d+\.\s*/, '')}
                    </p>
                  );
                }
                return <p key={i} className="text-[#414d60] leading-relaxed mb-3">{para}</p>;
              })}
            </section>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 bg-[#fbfbfd] rounded-3xl p-8 border border-gray-100 text-center">
          <h3 className="text-xl font-bold text-[#1e242c] mb-2">Ready to try AI-powered adaptive learning?</h3>
          <p className="text-[#414d60] text-sm mb-6">
            Upload your first PDF and get a personalized quiz in under a minute.
          </p>
          <Link
            href="/register"
            className="inline-block rounded-full bg-[#1d1d1f] text-white font-semibold px-8 py-3.5 hover:bg-[#2d2d2f] transition-colors"
          >
            Get Started Free
          </Link>
        </div>

        {/* Nav */}
        <div className="mt-12 pt-8 border-t border-gray-100 flex justify-between">
          <span className="text-sm text-gray-300">← Previous article</span>
          <Link href="/blog/knowledge-graphs-adaptive-learning-pdfs" className="text-sm font-semibold text-teal-600 hover:underline">
            Next: Knowledge Graphs & Bloom's Taxonomy →
          </Link>
        </div>
      </div>
    </article>
  );
}
