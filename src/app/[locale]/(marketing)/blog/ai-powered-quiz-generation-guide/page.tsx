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
      'Discover how RinKuzu\'s ALSS system — using SAINT-Bloom knowledge tracing, Dueling DQN curriculum planning, and Gemini-powered exercise generation — transforms any PDF lecture into a personalized adaptive quiz journey.',
  });
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  name: 'How AI Transforms PDF Learning into Adaptive Quizzes',
  headline: 'How AI Transforms PDF Learning into Adaptive Quizzes',
  description:
    'Discover how RinKuzu\'s ALSS system — SAINT-Bloom, Dueling DQN, and Gemini — transforms any PDF lecture into a personalized adaptive quiz journey.',
  url: `${siteUrl.origin}/blog/ai-powered-quiz-generation-guide`,
  datePublished: '2026-03-27',
  dateModified: '2026-03-27',
  author: {
    '@type': 'Person',
    name: 'RinKuzu Team',
    url: `${siteUrl.origin}/blog/authors/rinkuzu-team`,
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
    id: 'the-static-learning-problem',
    heading: 'The Static Learning Problem',
    body: `Every student has a folder of lecture notes, textbooks, and handouts — rich content that contains the knowledge they need to master a subject. Yet most of that material sits passive, read once and forgotten. The challenge isn't access to information; it's that static documents can't adapt to the reader. A 300-page textbook treats every student the same way, whether they're seeing the material for the first time or reviewing for an exam.

Research in cognitive science consistently shows that spaced repetition, active recall, and adaptive difficulty are among the most effective learning strategies. But applying these strategies manually requires significant expertise and time — time most students and teachers simply don't have. RinKuzu automates this entire pipeline: from any PDF document to a personalized, continuously adapting practice session.`,
  },
  {
    id: 'content-processor-pipeline',
    heading: 'From PDF to Knowledge Graph: The Content Processor Pipeline',
    body: `Before a single practice question is generated, RinKuzu's Content Processor transforms the raw PDF into a structured, machine-readable knowledge representation. This pipeline runs once per document and consists of seven steps:

**Step 1: PDF Loading.** Text is extracted from the document using PyPDF2 with caching to avoid reprocessing previously seen files.

**Step 2: Chunking.** The text is split into overlapping chunks (default: 4,000 characters, 400-character overlap) using a sliding window approach, ensuring context isn't lost at boundaries.

**Step 3: LLM Concept Extraction.** Each chunk is processed by Google Gemini (gemini-2.0-flash) to extract discrete knowledge concepts. For each concept, the LLM identifies: a unique concept_id, a name, a detailed definition, related LaTeX formulas, examples, and prerequisite relationships with other concepts. Only newly introduced or defined concepts are extracted — not ones merely listed in headers or table of contents.

**Step 4: Embedding Generation.** Each extracted concept is encoded using SentenceTransformer (all-MiniLM-L6-v2), producing a 384-dimensional embedding vector for semantic similarity comparison.

**Step 5: Concept Merging.** Two rounds of deduplication run: (1) name-based merge groups concepts with identical or near-identical names; (2) embedding-based merge uses cosine similarity (threshold: 0.85) to detect semantic duplicates. In practice, this reduces raw concept counts by ~27%.

**Step 6: Prerequisite Relation Verification (PRS).** Raw prerequisite relations from step 3 are verified using the Prerequisite Ranking Score (PRS) algorithm — based on the Reference Distance hypothesis: if a concept's definition has high semantic similarity to another concept's name, a prerequisite relationship is likely. PRS > τ (default τ=0.65) passes a pair to LLM for final validation. Pairs below threshold are rejected. This two-stage approach achieves a 50% acceptance rate on LectureBank benchmark while maintaining reasonable precision.

**Step 7: Knowledge Graph Construction.** Verified prerequisite pairs form directed edges in a DAG. Transitive reduction removes redundant edges, ensuring the graph has minimal edges while preserving all prerequisite relationships. The result: a directed, acyclic prerequisite graph ready for adaptive curriculum planning.`,
  },
  {
    id: 'saint-bloom-knowledge-tracing',
    heading: 'SAINT-Bloom: Multi-Level Knowledge Tracing',
    body: `Once the knowledge graph is built, RinKuzu needs to track each learner's mastery state across all concepts and cognitive levels. This is handled by **SAINT-Bloom** — a variant of the Separated Self-Attentional Neural Knowledge Tracing model (Choi et al., 2020) extended to model mastery at each Bloom's Taxonomy level independently.

Unlike standard knowledge tracing models that produce a single mastery probability per concept, SAINT-Bloom outputs: **P(correct | concept, Bloom_level)** — a separate probability for each of the six cognitive levels: Remember, Understand, Apply, Analyze, Evaluate, and Create.

This is critical because "knowing" a concept at the Remember level (memorizing a formula) is fundamentally different from "knowing" it at the Create level (designing a novel problem that uses it). Standard models collapse this distinction, leading to the illusion of mastery — students who score well on recall questions fail at application because the model never distinguished between the two levels.

SAINT-Bloom achieves AUC 0.8010 on the Junyi Academy benchmark. Its 128-dimensional hidden state captures the learner's full interaction history and serves as the primary input to the curriculum planning agent.`,
  },
  {
    id: 'd3qn-curriculum-planning',
    heading: 'Dueling DQN: Curriculum Sequencing with Hard Action Masking',
    body: `With a knowledge graph and a learner's current mastery state, the next challenge is: what should the learner practice *next*? This is the curriculum sequencing problem — and RinKuzu solves it with a **Dueling Double Deep Q-Network (D3QN)** agent trained using Gymnasium.

**Action Space:** Each action represents a (concept, Bloom_level) pair. With N concepts and 6 Bloom levels, the action space has N×6 dimensions. RinKuzu uses a concept-agnostic architecture: every concept is processed by the same shared backbone network, enabling the agent to generalize to any number of concepts without retraining.

**State Representation:** The 2,082-dimensional state vector encodes:
- Global features (130-dim): SAINT-Bloom hidden state + session progress scalars
- Per-concept features (N×8): bloom mastery per level, visited flag, prerequisite satisfaction flag

**Four-Layer Action Masking:** Before action selection, four filters block invalid actions:
1. **Prerequisite filter:** Concept is blocked if any prerequisite has max Bloom mastery < 0.75
2. **Bloom validity filter:** Actions not present in the dataset for that concept are blocked
3. **Sequential Bloom unlock:** Bloom level b+1 cannot be selected unless Bloom b has been attempted
4. **Mastery filter:** Actions where P(correct) ≥ 0.75 are blocked (already mastered)

**Dueling Architecture:** The Q-network separates the Value stream V(s) from the Advantage stream A(s,a), computing Q(s,a) = V(s) + A(s,a) − mean(A). This allows the agent to learn which states are valuable in general vs. which specific actions matter.

The agent was trained over 500,000 timesteps on a SAINT-based student simulator, achieving Reward 58.45 and Normalized Learning Gain 0.774 — outperforming Random, Sequential, Greedy, and Q-matrix baselines.`,
  },
  {
    id: 'gemini-exercise-generation',
    heading: 'Gemini 2.0 Flash: Adaptive Exercise Generation & Evaluation',
    body: `When D3QN selects action a* = (concept, Bloom_level), RinKuzu retrieves the concept's metadata (name, definition, formulas, examples) from the Concept Registry and calls **Gemini 2.0 Flash** to generate a tailored practice question.

The generation prompt is Bloom-specific:

| Level | Focus |
|---|---|
| 1. Remember | Recall definitions, formulas, facts |
| 2. Understand | Explain in own words, summarize, distinguish |
| 3. Apply | Use formulas in new situations, calculate |
| 4. Analyze | Compare methods, find patterns, decompose structure |
| 5. Evaluate | Judge correctness, prove/disprove, justify choices |
| 6. Create | Design new problems, compose multi-step solutions |

Gemini outputs structured exercises with five fields: QUESTION, TYPE (multiple_choice or free_form), OPTIONS (A/B/C/D), ANSWER, and EXPLANATION. Temperature is set to 0.7 — diverse enough to prevent question repetition, controlled enough to avoid factual errors.

**Mastery-adjusted difficulty:** Gemini also receives the learner's current P(correct) for this (concept, Bloom) pair. Low mastery (<50%) prompts the model to generate easier variants; high mastery (>70%) pushes toward harder applications.

**Answer evaluation:** After the learner submits a response, a separate Gemini call evaluates correctness and provides targeted Vietnamese-language feedback. If Gemini is unavailable, a deterministic string-match fallback ensures the session never stalls.

**Topic-Coherent Selection:** To prevent the D3QN agent from "jumping" between unrelated topics (which maximizes coverage metrics but frustrates learners), RinKuzu adds a light heuristic bias: +2.0 to Q-values for actions in the current topic for up to 3 consecutive steps. The agent still makes the final decision, but topic transitions are smoother.`,
  },
  {
    id: 'the-adaptive-loop',
    heading: 'The Complete Adaptive Loop: How It All Connects',
    body: `The seven-step adaptive loop runs continuously throughout each practice session:

1. **State Representation:** Current learner's SAINT-Bloom hidden state + mastery vector + progress scalars
2. **D3QN Decision:** ε-greedy action selection with four-layer masking → outputs (concept_id, Bloom_level)
3. **Metadata Retrieval:** Concept definition, formulas, examples fetched from Concept Registry
4. **Exercise Generation:** Gemini 2.0 Flash generates a Bloom-specific question tailored to current mastery
5. **Learner Response:** Student submits an answer
6. **Evaluation:** Gemini judges correctness and delivers feedback in Vietnamese
7. **State Update:** env.step() triggers SAINT forward pass → new hidden state, updated mastery matrix → loop returns to step 1

This closed loop means the system gets smarter with every interaction. Correct answers increase P(correct) for that (concept, Bloom) pair; incorrect answers decrease it. D3QN observes the updated mastery and dynamically rebalances — either staying to deepen understanding or moving to address weaker areas.

The entire pipeline — from uploading a calculus PDF to running your first adaptive session — completes in under 60 seconds. The knowledge graph, SAINT-Bloom state initialization, and D3QN recommendation engine all run server-side, invisible to the learner.`,
  },
  {
    id: 'getting-started',
    heading: 'Experience the Adaptive Loop Yourself',
    body: `The best way to understand this architecture is to experience it. Upload any lecture PDF — calculus, biology, economics, or physics — and watch RinKuzu build the knowledge graph, initialize your mastery state, and generate the first personalized practice question.

Your session will be shaped by your own knowledge graph, your own SAINT-Bloom state, and your own pace. No two learners take the same path through the same material.

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
            <span className="text-[#1e242c]">AI & PDFs</span>
          </nav>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
              AI in Education
            </span>
            <span className="text-xs text-[#414d60]">March 27, 2026 · 9 min read</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-[#1e242c] leading-tight mb-6">
            How AI Transforms PDF Learning into Adaptive Quizzes
          </h1>
          <p className="text-lg text-[#414d60] leading-relaxed">
            Discover how RinKuzu's ALSS system — SAINT-Bloom, Dueling DQN, and Gemini — transforms any PDF lecture into a personalized adaptive quiz journey.
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
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="mb-12">
            <h2 className="text-2xl font-bold text-[#1e242c] mb-4">{s.heading}</h2>
            <div className="prose prose-slate max-w-none text-[#414d60] leading-relaxed whitespace-pre-line">
              {s.body}
            </div>
          </section>
        ))}

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
