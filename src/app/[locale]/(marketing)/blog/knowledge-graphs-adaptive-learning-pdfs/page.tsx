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
    path: '/blog/knowledge-graphs-adaptive-learning-pdfs',
    title: "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide | RinKuzu",
    description:
      "Learn how prerequisite knowledge graphs — built with PRS scoring and transitive reduction — combined with Bloom's six cognitive levels create a scientifically-grounded adaptive learning path for any PDF document.",
  });
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  name: "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide",
  headline: "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide",
  description:
    "Learn how prerequisite knowledge graphs combined with Bloom's six cognitive levels create a scientifically-grounded adaptive learning path for any PDF document.",
  url: `${siteUrl.origin}/blog/knowledge-graphs-adaptive-learning-pdfs`,
  datePublished: '2026-03-20',
  dateModified: '2026-03-20',
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
    url: `${siteUrl.origin}/blog/knowledge-graphs-adaptive-learning-pdfs`,
  },
};

const sections = [
  {
    id: 'why-structure-matters',
    heading: 'Why Learning Structure Matters',
    body: `Every subject has an inherent structure — a web of concepts that build on each other. Calculus requires understanding functions before derivatives, derivatives before integrals, integrals before differential equations. Biology requires knowing cell structure before understanding organ systems. Learning these subjects effectively means respecting this structure.

Traditional study tools ignore this. A deck of flashcards or a static quiz bank treats every concept as equally related, equally important, and equally prerequisite-free. This creates a fundamental mismatch: learners who skip prerequisites struggle not because they're incapable, but because they're being asked to build on sand.

RinKuzu's approach is different. By modeling the knowledge structure of any document as a graph, and aligning practice questions to the cognitive demand of each concept, it creates a learning path that is both scientifically grounded and individually responsive.`,
  },
  {
    id: 'what-are-knowledge-graphs',
    heading: 'What Are Knowledge Graphs?',
    body: `A knowledge graph is a data structure where:

**Nodes** represent individual concepts. In a calculus PDF, nodes might include: "Limits," "Derivatives," "Chain Rule," "Integrals," "Integration by Parts."

**Edges** (directed arrows) represent prerequisite relationships. An edge "Limits → Derivatives" means: understanding limits is a prerequisite for understanding derivatives.

This graph is a directed acyclic graph (DAG) — a structure with no cycles, where learning always flows in one direction. You can't have an edge from "Derivatives" back to "Limits" in the prerequisite direction; they're separate paths.

In RinKuzu, this graph is generated automatically from your PDF using a seven-step Content Processor pipeline:
1. PDF text extraction (PyPDF2)
2. Sliding-window chunking (4,000 char / 400 char overlap)
3. LLM concept extraction (Gemini 2.0 Flash) — captures definitions, formulas, examples, and raw relations
4. Concept embedding (SentenceTransformer, 384-dim) for semantic similarity
5. Two-round merging: name-based + embedding-based (threshold 0.85), reducing duplicates by ~27%
6. Prerequisite Ranking Score (PRS) verification: only pairs with PRS > 0.65 advance to LLM validation
7. DAG construction with transitive reduction — removes redundant edges

The result is a visual map of your course that reveals exactly what you need to know before you can understand anything else.`,
  },
  {
    id: 'why-prerequisites-matter',
    heading: 'Why Prerequisite Relationships Change Everything',
    body: `Consider two students preparing for the same exam. Student A has a strong foundation in limits and derivatives but weak integration skills. Student B has strong integration skills but weak foundational algebra.

A static quiz bank gives both students the same questions. An adaptive system powered by knowledge graphs gives each student what they actually need: Student A gets integration practice; Student B gets foundational review.

More importantly, knowledge graphs reveal the *path* through a subject. If a learner struggles with "Integration by Parts," a knowledge graph diagnosis shows whether the gap is:
- The technique itself (understanding the formula)
- A prerequisite (weakness in basic derivatives or algebra)
- A deeper gap (unresolved concepts in earlier chapters)

In RinKuzu's Dueling DQN curriculum agent, prerequisite relationships are enforced by a hard prerequisite filter in the four-layer action masking system. A concept is entirely blocked from selection if any prerequisite concept has max Bloom mastery below 0.75. This is not a soft suggestion — it's a hard constraint. No practice question on Integration by Parts will appear until Derivatives and basic algebra are sufficiently mastered.

This diagnostic power is impossible with a flat list of practice questions. The graph makes the structure of misunderstanding visible, enabling targeted remediation.`,
  },
  {
    id: 'blooms-taxonomy-explained',
    heading: "Bloom's Taxonomy: Six Levels of Cognitive Demand",
    body: `In 1956, Benjamin Bloom and collaborators published a taxonomy of educational objectives, later revised by Anderson and Krathwohl (2001). It classifies learning objectives across two dimensions: Knowledge (factual, conceptual, procedural, metacognitive) and Cognitive Process (six levels from Remember to Create).

The cognitive process levels — which RinKuzu uses for question generation — are:

**1. Remember (Recall)**
Memorize and retrieve relevant knowledge.
Example question: "What is the formula for the derivative of xⁿ?"

**2. Understand (Explain)**
Construct meaning from oral, written, or graphic messages.
Example question: "Explain in your own words what a derivative represents geometrically."

**3. Apply**
Carry out or use a procedure in a given situation.
Example question: "Use the chain rule to find the derivative of sin(x²)."

**4. Analyze**
Draw connections among ideas, differentiate between parts.
Example question: "Why does the chain rule work for composite functions? Where does it break down?"

**5. Evaluate**
Make judgments based on criteria and standards.
Example question: "Which integration technique would be most efficient for ∫x·sin(x)dx, and why?"

**6. Create**
Put elements together to form a coherent pattern or structure.
Example question: "Design a real-world scenario that requires using a derivative to solve an optimization problem."`,
  },
  {
    id: 'why-six-levels-matter',
    heading: "Why Practicing All Six Levels Matters",
    body: `Most quiz platforms focus on Remember and Understand. This creates a dangerous pattern: students who score well on practice tests fail exams and real-world applications.

The reason is the **illusion of fluency**. Remember-level questions can be answered by pattern-matching and recognition. A student who sees a derivative question and remembers the pattern "power rule → subtract 1 from exponent" can answer correctly without understanding *why* the rule works or *when* it applies.

Bloom's higher levels — Apply, Analyze, Evaluate, Create — reveal whether understanding is real. These levels require:
- Applying concepts to *new* situations (not ones you've seen before)
- Analyzing *relationships* between concepts
- Evaluating which approach is best in a given context
- Creating *new* outputs using the concept

In RinKuzu, each concept is tracked with a separate mastery probability per Bloom level (the Bloom Mastery Matrix). The SAINT-Bloom knowledge tracing model maintains P(correct | concept, Bloom_level) — so the system knows whether your mastery at Apply is genuine or whether it's riding on strong Remember performance.

Each level builds the neural pathways that transfer learning to novel problems. RinKuzu's adaptive system ensures learners practice across all six levels, preventing the illusion of mastery that comes from Remember-only review.`,
  },
  {
    id: 'how-they-combine',
    heading: "Knowledge Graphs + Bloom's: A Powerful Combination",
    body: `When knowledge graphs and Bloom's Taxonomy work together, each concept in the graph gets questions at multiple cognitive levels. The knowledge graph determines *what* to practice; Bloom's Taxonomy determines *how hard* to practice it.

This creates a two-dimensional learning map:

| Concept | Remember | Understand | Apply | Analyze | Evaluate | Create |
|---|---|---|---|---|---|---|
| Limits | ✅ | ✅ | ✅ | ✅ | — | — |
| Derivatives | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Integrals | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

(Earlier concepts in the prerequisite chain are typically limited to lower Bloom levels; later concepts — which require synthesis of earlier knowledge — can reach Analyze, Evaluate, and Create.)

RinKuzu's Dueling DQN agent selects questions based on both dimensions simultaneously: the concept with the lowest mastery probability AND the Bloom level most likely to advance understanding — but only if all prerequisites are satisfied (prerequisite filter ≥ 0.75) and no higher Bloom levels have been skipped (sequential Bloom unlock).

This produces a practice session that is simultaneously efficient (targeting weak spots) and rigorous (pushing toward higher-order thinking). The SAINT-Bloom knowledge tracer then updates each (concept, Bloom) pair separately after every response, creating a fine-grained mastery profile that drives the next recommendation.`,
  },
  {
    id: 'getting-started',
    heading: 'Experience It Yourself',
    body: `The best way to understand this framework is to experience it. Upload any PDF lecture — on calculus, biology, economics, or history — and watch RinKuzu build the knowledge graph and generate adaptive practice questions across all six Bloom levels.

Your practice sessions will be shaped by your own knowledge graph, your own SAINT-Bloom mastery state, and your own pace. No two learners take the same path through the same material.

Start with the free plan — no credit card required. Your first personalized quiz is ready in under a minute.`,
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
            <Link href="/blog" className="hover:text-[#1e242c] transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-[#1e242c]">Knowledge Graphs</span>
          </nav>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
              Learning Science
            </span>
            <span className="text-xs text-[#414d60]">March 20, 2026 · 10 min read</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-[#1e242c] leading-tight mb-6">
            Knowledge Graphs and Bloom&apos;s Taxonomy: A Complete Guide
          </h1>
          <p className="text-lg text-[#414d60] leading-relaxed">
            Learn how prerequisite graphs combined with Bloom&apos;s six cognitive levels create a scientifically-grounded adaptive learning path for any PDF document.
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
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80"
            alt="Abstract knowledge graph network visualization representing interconnected learning concepts"
            width={900}
            height={500}
            className="w-full object-cover"
            priority
          />
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 pb-20">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="mb-12">
            <h2 className="text-2xl font-bold text-[#1e242c] mb-4">{s.heading}</h2>
            <div className="text-[#414d60] leading-relaxed whitespace-pre-line">
              {s.body}
            </div>
          </section>
        ))}

        {/* CTA */}
        <div className="mt-16 bg-[#fbfbfd] rounded-3xl p-8 border border-gray-100 text-center">
          <h3 className="text-xl font-bold text-[#1e242c] mb-2">See Knowledge Graphs in Action</h3>
          <p className="text-[#414d60] text-sm mb-6">
            Upload a PDF and watch RinKuzu build a knowledge graph and adaptive quiz — free, in under a minute.
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
          <Link href="/blog/ai-powered-quiz-generation-guide" className="text-sm font-semibold text-teal-600 hover:underline">
            ← Previous: AI-Powered Quiz Generation
          </Link>
          <span className="text-sm text-gray-300">More articles coming soon →</span>
        </div>
      </div>
    </article>
  );
}
