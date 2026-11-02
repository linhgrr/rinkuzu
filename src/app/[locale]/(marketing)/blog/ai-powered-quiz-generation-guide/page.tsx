import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { buildLocalizedMetadata, canonicalFor, siteUrl } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { ReadingProgressBar } from '@/components/blog/ReadingProgressBar';
import { ShareButtons } from '@/components/blog/ShareButtons';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { extractHeadingsFromMarkdown } from '@/lib/blog-utils';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const base = buildLocalizedMetadata({
    locale,
    path: '/blog/ai-powered-quiz-generation-guide',
    title: 'How AI Transforms PDF Learning into Adaptive Quizzes | RinKuzu',
    description:
      "Discover how RinKuzu's ALSS system turns supported PDF lecture material into adaptive quiz practice.",
    imagePath: 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=1200&q=80',
  });
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      title: 'How AI Transforms PDF Learning into Adaptive Quizzes | RinKuzu',
      description:
        "Discover how RinKuzu's ALSS system turns supported PDF lecture material into adaptive quiz practice.",
      type: 'article',
      publishedTime: '2026-03-27T00:00:00.000Z',
      modifiedTime: '2026-03-27T00:00:00.000Z',
      authors: [canonicalFor(locale, '/blog/authors/rinkuzu-team')],
      images: [
        {
          url: 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=1200&q=80',
          width: 1200,
          height: 630,
          alt: 'Open textbook with highlighted notes beside a laptop showing an AI learning interface',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'How AI Transforms PDF Learning into Adaptive Quizzes | RinKuzu',
      description:
        "Discover how RinKuzu's ALSS system turns supported PDF lecture material into adaptive quiz practice.",
      images: ['https://images.unsplash.com/photo-1589998059171-988d887df646?w=1200&q=80'],
    },
  };
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  name: 'How AI Transforms PDF Learning into Adaptive Quizzes',
  headline: 'How AI Transforms PDF Learning into Adaptive Quizzes',
  description:
    "Discover how RinKuzu's ALSS system turns supported PDF lecture material into adaptive quiz practice.",
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
  image: {
    '@type': 'ImageObject',
    url: 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=1200&q=80',
    width: 1200,
    height: 630,
  },
  wordCount: 1350,
  timeRequired: 'PT9M',
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl.origin },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl.origin}/blog` },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'How AI Transforms PDF Learning into Adaptive Quizzes',
      item: `${siteUrl.origin}/blog/ai-powered-quiz-generation-guide`,
    },
  ],
};

const postContent = `
## The Static Learning Problem
Every student has a folder of lecture notes, textbooks, and handouts — rich content that contains the knowledge they need to master a subject. Yet most of that material sits passive, read once and forgotten. The challenge isn't access to information; it's that static documents can't adapt to the reader. A 300-page textbook treats every student the same way, whether they're seeing the material for the first time or reviewing for an exam.

RinKuzu combines spaced repetition, active recall, and adaptive difficulty in a practice flow. It turns supported PDF material into a personalized practice session.

## From PDF to Knowledge Graph: The Content Processor Pipeline
Before a single practice question is generated, RinKuzu's Content Processor transforms the raw PDF into a structured, machine-readable knowledge representation. This pipeline runs once per document and consists of seven steps:

1. **PDF Loading**: Text is extracted from the document using PyPDF2 with caching to avoid reprocessing previously seen files.
2. **Chunking**: The text is split into overlapping chunks (default: 4,000 characters, 400-character overlap) using a sliding window approach, ensuring context isn't lost at boundaries.
3. **LLM Concept Extraction**: Each chunk is processed by Google Gemini (gemini-2.0-flash) to extract discrete knowledge concepts. For each concept, the LLM identifies: a unique concept_id, a name, a detailed definition, related LaTeX formulas, examples, and prerequisite relationships with other concepts. Only newly introduced or defined concepts are extracted — not ones merely listed in headers or table of contents.
4. **Embedding Generation**: Each extracted concept is encoded using SentenceTransformer (all-MiniLM-L6-v2), producing a 384-dimensional embedding vector for semantic similarity comparison.
5. **Concept Merging**: Two rounds of deduplication run: (1) name-based merge groups concepts with identical or near-identical names; (2) embedding-based merge uses cosine similarity (threshold: 0.85) to detect semantic duplicates. In practice, this reduces raw concept counts by ~27%.
6. **Prerequisite Relation Verification (PRS)**: Raw prerequisite relations from step 3 are verified using the Prerequisite Ranking Score (PRS) algorithm — based on the Reference Distance hypothesis: if a concept's definition has high semantic similarity to another concept's name, a prerequisite relationship is likely. PRS > τ (default τ=0.65) passes a pair to LLM for final validation. Pairs below threshold are rejected. This two-stage approach achieves a 50% acceptance rate on LectureBank benchmark while maintaining reasonable precision.
7. **Knowledge Graph Construction**: Verified prerequisite pairs form directed edges in a DAG. Transitive reduction removes redundant edges, ensuring the graph has minimal edges while preserving all prerequisite relationships. The result: a directed, acyclic prerequisite graph ready for adaptive curriculum planning.

## SAINT-Bloom: Multi-Level Knowledge Tracing
Once the knowledge graph is built, RinKuzu needs to track each learner's mastery state across all concepts and cognitive levels. This is handled by **SAINT-Bloom** — a variant of the Separated Self-Attentional Neural Knowledge Tracing model (Choi et al., 2020) extended to model mastery at each Bloom's Taxonomy level independently.

Unlike standard knowledge tracing models that produce a single mastery probability per concept, SAINT-Bloom outputs: **P(correct | concept, Bloom_level)** — a separate probability for each of the six cognitive levels: Remember, Understand, Apply, Analyze, Evaluate, and Create.

This is critical because "knowing" a concept at the Remember level (memorizing a formula) is fundamentally different from "knowing" it at the Create level (designing a novel problem that uses it). Standard models collapse this distinction, leading to the illusion of mastery — students who score well on recall questions fail at application because the model never distinguished between the two levels.

SAINT-Bloom achieves AUC 0.8010 on the Junyi Academy benchmark. Its 128-dimensional hidden state captures the learner's full interaction history and serves as the primary input to the curriculum planning agent.

## Dueling DQN: Curriculum Sequencing with Hard Action Masking
With a knowledge graph and a learner's current mastery state, the next challenge is: what should the learner practice *next*? This is the curriculum sequencing problem — and RinKuzu solves it with a **Dueling Double Deep Q-Network (D3QN)** agent trained using Gymnasium.

**Action Space**: Each action represents a (concept, Bloom_level) pair. With N concepts and 6 Bloom levels, the action space has N×6 dimensions. RinKuzu uses a concept-agnostic architecture: every concept is processed by the same shared backbone network, enabling the agent to generalize to any number of concepts without retraining.

**State Representation**: The 2,082-dimensional state vector encodes:
- Global features (130-dim): SAINT-Bloom hidden state + session progress scalars
- Per-concept features (N×8): bloom mastery per level, visited flag, prerequisite satisfaction flag

### Four-Layer Action Masking
Before action selection, four filters block invalid actions:

1. **Prerequisite filter**: Concept is blocked if any prerequisite has max Bloom mastery < 0.75
2. **Bloom validity filter**: Actions not present in the dataset for that concept are blocked
3. **Sequential Bloom unlock**: Bloom level b+1 cannot be selected unless Bloom b has been attempted
4. **Mastery filter**: Actions where P(correct) ≥ 0.75 are blocked (already mastered)

The agent was trained over 500,000 timesteps on a SAINT-based student simulator, achieving Reward 58.45 and Normalized Learning Gain 0.774 — outperforming Random, Sequential, Greedy, and Q-matrix baselines.

## Gemini 2.0 Flash: Adaptive Exercise Generation & Evaluation
When D3QN selects action a* = (concept, Bloom_level), RinKuzu retrieves the concept's metadata (name, definition, formulas, examples) from the Concept Registry and calls **Gemini 2.0 Flash** to generate a tailored practice question.

| Level | Focus |
|---|---|---|
| 1. Remember | Recall definitions, formulas, facts |
| 2. Understand | Explain in own words, summarize, distinguish |
| 3. Apply | Use formulas in new situations, calculate |
| 4. Analyze | Compare methods, find patterns, decompose structure |
| 5. Evaluate | Judge correctness, prove/disprove, justify choices |
| 6. Create | Design new problems, compose multi-step solutions |

Gemini outputs structured exercises with five fields: QUESTION, TYPE (multiple_choice or free_form), OPTIONS (A/B/C/D), ANSWER, and EXPLANATION. Temperature is set to 0.7 — diverse enough to prevent question repetition, controlled enough to avoid factual errors.

**Mastery-adjusted difficulty**: Gemini also receives the learner's current P(correct) for this (concept, Bloom) pair. Low mastery (<50%) prompts the model to generate easier variants; high mastery (>70%) pushes toward harder applications.

**Answer evaluation**: After the learner submits a response, a separate Gemini call evaluates correctness and provides targeted Vietnamese-language feedback. A deterministic string-match fallback is available when Gemini is unavailable.

## The Complete Adaptive Loop: How It All Connects
The seven-step adaptive loop runs continuously throughout each practice session:

1. **State Representation**: Current learner's SAINT-Bloom hidden state + mastery vector + progress scalars
2. **D3QN Decision**: ε-greedy action selection with four-layer masking → outputs (concept_id, Bloom_level)
3. **Metadata Retrieval**: Concept definition, formulas, examples fetched from Concept Registry
4. **Exercise Generation**: Gemini 2.0 Flash generates a Bloom-specific question tailored to current mastery
5. **Learner Response**: Student submits an answer
6. **Evaluation**: Gemini judges correctness and delivers feedback in Vietnamese
7. **State Update**: env.step() triggers SAINT forward pass → new hidden state, updated mastery matrix → loop returns to step 1

This closed loop means the system gets smarter with every interaction. Correct answers increase P(correct) for that (concept, Bloom) pair; incorrect answers decrease it. D3QN observes the updated mastery and dynamically rebalances — either staying to deepen understanding or moving to address weaker areas.

## Experience the Adaptive Loop Yourself
The best way to understand this architecture is to experience it. Upload any lecture PDF — calculus, biology, economics, or physics — and watch RinKuzu build the knowledge graph, initialize your mastery state, and generate the first personalized practice question.

Your session will be shaped by your own knowledge graph, your own SAINT-Bloom state, and your own pace. No two learners take the same path through the same material.

Start with supported PDF material and create a personalized practice session.

## References

1. **Choi, Y., Lee, Y., Shin, D., & Kim, J. (2020).** SAINT: Integrating Temporal Reasoning and Knowledge Tracing Models for Adaptive Learning on Codeforces Problems. *arXiv preprint arXiv:2008.10056*. [https://arxiv.org/abs/2008.10056](https://arxiv.org/abs/2008.10056)

2. **Corbett, A. T., & Anderson, J. R. (1995).** Knowledge Tracing: Modeling the Acquisition of Procedural Knowledge. *User Modeling and User-Adapted Interaction, 4*(4), 253–278. [https://doi.org/10.1007/BF01099821](https://doi.org/10.1007/BF01099821)

3. **Liang, W., Zhang, Y., Wu, H., Nie, Y., & Yang, F. (2022).** LectureBank: A Benchmark for Prerequisite Discovery from Educational Texts. *Findings of ACL 2022*. [https://aclanthology.org/2022.findings-acl.1/](https://aclanthology.org/2022.findings-acl.1/)

4. **Wang, Z., Lan, A. S., & Baraniuk, R. (2016).** Mathematical Language Processing: Automatic Understanding and Generation of Mathematical Reasoning. *arXiv preprint arXiv:1605.08286*. [https://arxiv.org/abs/1605.08286](https://arxiv.org/abs/1605.08286)

5. **Clement, B., Roy, D., Oudeyer, P.-Y., & Lopes, M. (2015).** Multi-Armed Bandits for Intelligent Tutoring Systems. *arXiv preprint arXiv:1310.3174*. [https://arxiv.org/abs/1310.3174](https://arxiv.org/abs/1310.3174)

6. **Van de Broeck, G., & Gybels, J. (2019).** Dueling Buffer: A Practical Dueling Bandits Algorithm for Online Learning. *Proceedings of the AAAI Conference on Artificial Intelligence, 33*(01), 330–336. [https://doi.org/10.1609/aaai.v33i01.3301330](https://doi.org/10.1609/aaai.v33i01.3301330)
`;

export default async function BlogPost({ params }: Props) {
  const { locale } = await params;
  const postUrl = canonicalFor(locale, '/blog/ai-powered-quiz-generation-guide');
  const postTitle = 'How AI Transforms PDF Learning into Adaptive Quizzes';
  const headings = extractHeadingsFromMarkdown(postContent);

  return (
    <article className="min-h-screen bg-white">
      <ReadingProgressBar />
      <JsonLd id="article-schema" data={articleSchema} />
      <JsonLd id="breadcrumb-schema" data={breadcrumbSchema} />

      {/* Hero */}
      <header className="bg-[var(--bg-section)] border-b border-neutral-100">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-12">
          <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-8">
            <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-[var(--text-primary)] transition-colors">
              Blog
            </Link>
            <span>/</span>
            <span className="text-[var(--text-primary)]">AI & PDFs</span>
          </nav>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-trust bg-green-50 px-3 py-1 rounded-full">
              AI in Education
            </span>
            <span className="text-xs text-[var(--text-muted)]">March 27, 2026 · 9 min read</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold text-[var(--text-primary)] leading-tight mb-6">
            {postTitle}
          </h1>
          <p className="text-xl text-[var(--text-muted)] leading-relaxed font-medium">
            Discover how RinKuzu&apos;s ALSS system, SAINT-Bloom, Dueling DQN, and Gemini, turns
            supported PDF lecture material into adaptive quiz practice.
          </p>
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-neutral-100">
            <div className="size-11 rounded-full bg-[var(--text-primary)] flex items-center justify-center text-white font-bold text-sm ring-4 ring-white shadow-sm">
              RK
            </div>
            <div>
              <Link
                href="/blog/authors/rinkuzu-team"
                className="text-sm font-semibold text-[var(--text-primary)] hover:text-brand-trust transition-colors"
              >
                RinKuzu Team
              </Link>
              <p className="text-xs text-[var(--text-muted)]">AI Learning Platform</p>
            </div>
          </div>
        </div>
      </header>

      {/* Article body: centered content, ToC fixed to the right */}
      <div className="max-w-7xl mx-auto px-6 py-12 relative">
        {/* Hero image */}
        <div className="mb-12 max-w-3xl mx-auto">
          <div className="rounded-3xl overflow-hidden shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] ring-1 ring-black/5">
            <Image
              src="https://images.unsplash.com/photo-1589998059171-988d887df646?w=1200&q=80"
              alt="Open textbook with highlighted notes beside a laptop showing an AI learning interface"
              width={900}
              height={500}
              className="w-full object-cover aspect-[16/9]"
              priority
            />
          </div>
        </div>

        {/* Article content — centered */}
        <div className="max-w-3xl mx-auto">
          <MarkdownRenderer content={postContent} />

          <ShareButtons url={postUrl} title={postTitle} />

          {/* CTA */}
          <div className="mt-16 bg-gradient-to-br from-[var(--text-primary)] to-[#2d2d2f] rounded-[2rem] p-10 text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 size-64 bg-green-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 size-64 bg-green-500/10 rounded-full blur-3xl -ml-32 -mb-32"></div>
            <div className="relative z-10 text-center max-w-xl mx-auto">
              <h3 className="text-2xl md:text-3xl font-semibold mb-4">
                Start your adaptive journey today
              </h3>
              <p className="text-neutral-300 text-lg mb-8">
                Upload your first PDF and see the ALSS pipeline in action. Join students mastering
                complex topics with RinKuzu.
              </p>
              <Link
                href="/register?next=/adaptive/upload"
                className="inline-flex items-center justify-center rounded-full bg-brand-trust px-10 py-4 font-bold text-white shadow-lg shadow-green-500/20 transition-[background-color,transform] hover:scale-105 hover:bg-brand-trust-hover active:scale-95"
              >
                Get Started Free
              </Link>
              <p className="mt-4 text-xs text-neutral-400">
                No credit card required · Free plan available
              </p>
              <p className="mt-2 text-sm text-neutral-300">
                Questions about uploads or plans?{' '}
                <Link href="/faq" className="underline hover:text-white">
                  Read the FAQ
                </Link>
              </p>
            </div>
          </div>

          {/* Post navigation */}
          <div className="mt-16 pt-10 border-t border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                Previous
              </span>
              <span className="text-neutral-300">No previous post</span>
            </div>
            <Link
              href="/blog/knowledge-graphs-adaptive-learning-pdfs"
              className="flex flex-col gap-1 text-right group w-full sm:w-auto"
            >
              <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                Next Article
              </span>
              <span className="text-[var(--text-primary)] font-bold group-hover:text-brand-trust transition-colors">
                Knowledge Graphs & Bloom&apos;s Taxonomy →
              </span>
            </Link>
          </div>
        </div>

        {/* Table of Contents — right, fixed to container edge */}
        <aside className="hidden xl:block absolute right-6 top-12 w-56 flex-shrink-0">
          <div className="sticky top-24">
            <TableOfContents headings={headings} />
          </div>
        </aside>
      </div>
    </article>
  );
}
