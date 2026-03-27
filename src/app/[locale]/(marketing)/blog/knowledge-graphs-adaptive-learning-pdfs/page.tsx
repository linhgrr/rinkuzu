import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { buildLocalizedMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { siteUrl } from '@/lib/seo';
import { ReadingProgressBar } from '@/components/blog/ReadingProgressBar';
import { ShareButtons } from '@/components/blog/ShareButtons';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { extractHeadingsFromMarkdown } from '@/lib/blog-utils';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const canonicalUrl = `${siteUrl.origin}/blog/knowledge-graphs-adaptive-learning-pdfs`;
  const base = buildLocalizedMetadata({
    locale,
    path: '/blog/knowledge-graphs-adaptive-learning-pdfs',
    title: "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide | RinKuzu",
    description:
      "Learn how prerequisite knowledge graphs combined with Bloom's six cognitive levels create a scientifically-grounded adaptive learning path for any PDF document.",
    imagePath: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80',
  });
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      title: "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide | RinKuzu",
      description:
        "Learn how prerequisite knowledge graphs combined with Bloom's six cognitive levels create a scientifically-grounded adaptive learning path for any PDF document.",
      url: canonicalUrl,
      type: 'article',
      publishedTime: '2026-03-20T00:00:00.000Z',
      modifiedTime: '2026-03-20T00:00:00.000Z',
      authors: [`${siteUrl.origin}/blog/authors/rinkuzu-team`],
      images: [
        {
          url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80',
          width: 1200,
          height: 630,
          alt: "Abstract knowledge graph network visualization representing interconnected learning concepts",
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide | RinKuzu",
      description:
        "Learn how prerequisite knowledge graphs combined with Bloom's six cognitive levels create a scientifically-grounded adaptive learning path.",
      images: ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80'],
    },
  };
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
    url: `${siteUrl.origin}/blog/knowledge-graphs-adaptive-learning-pdfs`,
  },
  image: {
    '@type': 'ImageObject',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80',
    width: 1200,
    height: 630,
  },
  wordCount: 1900,
  timeRequired: 'PT14M',
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
      name: "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide",
      item: `${siteUrl.origin}/blog/knowledge-graphs-adaptive-learning-pdfs`,
    },
  ],
};

const markdownContent = `
## Why Learning Structure Matters

Every subject has an inherent structure — a web of concepts that build on each other. Calculus requires understanding functions before derivatives, derivatives before integrals, integrals before differential equations. Biology requires knowing cell structure before understanding organ systems. Learning these subjects effectively means respecting this structure.

Traditional study tools ignore this. A deck of flashcards or a static quiz bank treats every concept as equally related, equally important, and equally prerequisite-free. This creates a fundamental mismatch: learners who skip prerequisites struggle not because they're incapable, but because they're being asked to build on sand.

RinKuzu's approach is different. By modeling the knowledge structure of any document as a graph, and aligning practice questions to the cognitive demand of each concept, it creates a learning path that is both scientifically grounded and individually responsive.

## What Are Knowledge Graphs?

A knowledge graph is a data structure where:

- **Nodes** represent individual concepts. In a calculus PDF, nodes might include: "Limits," "Derivatives," "Chain Rule," "Integrals," "Integration by Parts."
- **Edges** (directed arrows) represent prerequisite relationships. An edge "Limits → Derivatives" means: understanding limits is a prerequisite for understanding derivatives.

This graph is a directed acyclic graph (DAG) — a structure with no cycles, where learning always flows in one direction.

In RinKuzu, this graph is generated automatically from your PDF using a seven-step Content Processor pipeline:

1. **PDF Loading**: Text extracted with PyPDF2 (cached).
2. **Chunking**: 4,000-char sliding window, 400-char overlap.
3. **LLM Concept Extraction**: Gemini 2.0 Flash — definitions, formulas, examples, raw relations.
4. **Embedding**: SentenceTransformer (all-MiniLM-L6-v2, 384-dim).
5. **Concept Merging**: Name-based + embedding-based (cosine sim ≥ 0.85), reducing duplicates ~27%.
6. **PRS Verification**: Prerequisite Ranking Score > 0.65 → LLM validation. ~50% acceptance rate.
7. **DAG Construction**: Transitive reduction removes redundant edges.

The result is a visual map of your course that reveals exactly what you need to know before you can understand anything else.

## Why Prerequisite Relationships Change Everything

Consider two students preparing for the same exam. Student A has a strong foundation in limits and derivatives but weak integration skills. Student B has strong integration skills but weak foundational algebra.

A static quiz bank gives both students the same questions. An adaptive system powered by knowledge graphs gives each student what they actually need.

In RinKuzu's Dueling DQN agent, prerequisite relationships are enforced by a hard prerequisite filter in the four-layer action masking system. A concept is entirely blocked from selection if any prerequisite has max Bloom mastery below 0.75. This is not a soft suggestion — it's a hard constraint. No practice question on Integration by Parts will appear until Derivatives and basic algebra are sufficiently mastered.

This diagnostic power is impossible with a flat list of practice questions. The graph makes the structure of misunderstanding visible.

## Bloom's Taxonomy: Six Levels of Cognitive Demand

In 1956, Benjamin Bloom published a taxonomy of educational objectives, later revised by Anderson and Krathwohl (2001). The cognitive process levels — which RinKuzu uses for question generation — are:

### 1. Remember (Recall)
Memorize and retrieve relevant knowledge.
Example: "What is the formula for the derivative of xⁿ?"

### 2. Understand (Explain)
Construct meaning from oral, written, or graphic messages.
Example: "Explain in your own words what a derivative represents geometrically."

### 3. Apply
Carry out or use a procedure in a given situation.
Example: "Use the chain rule to find the derivative of sin(x²)."

### 4. Analyze
Draw connections among ideas, differentiate between parts.
Example: "Why does the chain rule work for composite functions? Where does it break down?"

### 5. Evaluate
Make judgments based on criteria and standards.
Example: "Which integration technique would be most efficient for ∫x·sin(x)dx, and why?"

### 6. Create
Put elements together to form a coherent pattern or structure.
Example: "Design a real-world scenario that requires using a derivative to solve an optimization problem."

## Why Practicing All Six Levels Matters

Most quiz platforms focus on Remember and Understand. This creates a dangerous pattern: students who score well on practice tests fail exams.

The reason is the **illusion of fluency**. Remember-level questions can be answered by pattern-matching. A student who remembers the pattern "power rule → subtract 1 from exponent" can answer correctly without understanding *why* the rule works or *when* it applies.

Bloom's higher levels — Apply, Analyze, Evaluate, Create — reveal whether understanding is real. RinKuzu's SAINT-Bloom knowledge tracing model maintains P(correct | concept, Bloom_level) — so the system knows whether your mastery at Apply is genuine or riding on strong Remember performance.

Each level builds the neural pathways that transfer learning to novel problems. RinKuzu ensures learners practice across all six levels, preventing the illusion of mastery.

## Knowledge Graphs + Bloom's: A Powerful Combination

When knowledge graphs and Bloom's Taxonomy work together, the knowledge graph determines *what* to practice; Bloom's Taxonomy determines *how hard*.

This creates a two-dimensional learning map:

| Concept | Remember | Understand | Apply | Analyze | Evaluate | Create |
|---|---|---|---|---|---|---|
| Limits | ✅ | ✅ | ✅ | ✅ | — | — |
| Derivatives | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Integrals | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

(Earlier concepts are limited to lower Bloom levels; later concepts can reach Analyze, Evaluate, and Create.)

RinKuzu's Dueling DQN agent selects questions based on both dimensions simultaneously: the weakest (concept, Bloom) pair where all prerequisites are satisfied. The SAINT-Bloom tracer updates each pair separately after every response.

## The Research Behind RinKuzu's Approach

RinKuzu's adaptive learning architecture draws on a body of educational research spanning cognitive science, machine learning, and learning analytics.

**Knowledge graphs in education** have roots in the field of Intelligent Tutoring Systems (ITS), dating back to ITS tutors like ANDES (for physics) and Cognitive Tutors (based on ACT-R theory). What makes RinKuzu different is scale: while traditional ITS systems required domain experts to hand-code the knowledge structure, RinKuzu's Content Processor extracts that structure automatically from any PDF using large language models. This bridges decades of ITS research with modern AI capabilities.

**Bayesian Knowledge Tracing (BKT)** — the foundational model behind RinKuzu's mastery tracking — was introduced by Corbett and Anderson in 1995. BKT models each skill as a binary latent variable (learned vs. not learned), updating the learned probability based on observed performance. SAINT-Bloom extends this by decomposing mastery into six levels, recognizing that "learning" a concept is not binary — a student can remember a formula without being able to apply it.

**Reinforcement Learning for curriculum sequencing** was first applied to educational games by the 2010s, with early work by Clement et al. (2015) demonstrating that RL agents could outperform fixed sequencing strategies. The Dueling DQN architecture used in RinKuzu — which separates value estimation from advantage estimation — is particularly well-suited to education because it handles the large, sparse action space of (concept, Bloom) pairs more stably than vanilla DQN.

**SAINT**, introduced by Choi et al. (2020), uses a transformer encoder-decoder architecture that processes the full sequence of learner interactions (exercise_id, correctness, timestamp) rather than modeling each skill independently. RinKuzu extends SAINT by adding Bloom's Taxonomy level as an explicit input dimension, enabling the multi-level mastery tracking that drives the curriculum agent.

## Limitations and Honest Tradeoffs

No system is without tradeoffs, and being transparent about them builds trust.

**Concept extraction quality depends on PDF quality.** Text-based PDFs with clear structure produce the best knowledge graphs. Scanned image PDFs (common in older textbooks) require OCR preprocessing and may produce lower-quality concept extractions. We recommend using the most recent, digitally-born version of a document for the best results.

**Prerequisite relationships are probabilistic.** The PRS verification step uses a 0.65 threshold — meaning roughly 50% of LLM-proposed relations are rejected. This is a conservative tradeoff favoring precision over recall. For highly specialized domains (e.g., advanced mathematics), you may want to manually verify and correct the knowledge graph after generation.

**The illusion of mastery persists at higher levels.** Even with Bloom-level tracking, a system can only measure what it tests. If a student becomes skilled at recognizing the *pattern* of Analyze-level questions — without genuinely deepening conceptual understanding — the system may overestimate mastery. This is a known limitation of any assessment-based knowledge tracer. The Evaluate and Create levels, which require genuine synthesis and original thought, are particularly hard to assess reliably through multiple-choice format.

**Cold-start for new documents.** The first time you upload a PDF, RinKuzu must process it from scratch — a process that takes 30–120 seconds depending on document length. Cached concepts from previously processed documents reduce this significantly on subsequent uploads.

Despite these limitations, the combination of knowledge graphs + Bloom's Taxonomy + RL curriculum sequencing represents a significant step forward from static flashcard decks. The key is using these tools as supplements to — not replacements for — deep engagement with your source material.

## The Future: Towards Truly Intelligent Tutoring

RinKuzu's architecture points toward several exciting directions:

- **Concept chaining**: linking related concepts across different documents, so studying a calculus PDF automatically surfaces relevant physics prerequisites
- **Learner modeling diversity**: moving beyond single-learner models to group-level adaptive sequencing for classroom use
- **Open知识图谱**: communities building shared knowledge graphs for canonical subjects — imagine a shared prerequisite graph for "University Calculus" that every RinKuzu user contributes to and benefits from
- **Multimodal inputs**: extending beyond PDFs to lecture videos, slide decks, and hand-written notes

These are ambitious goals. But the foundation is solid: a knowledge graph extracted from your material, a model of where you are in that graph, and an AI that knows what question to ask you next.

## Experience It Yourself

Upload any PDF lecture — calculus, biology, economics, or history — and watch RinKuzu build the knowledge graph and generate adaptive practice questions across all six Bloom levels.

Start with the free plan — no credit card required. Your first personalized quiz is ready in under a minute.

## References

1. **Anderson, L. W., & Krathwohl, D. R. (Eds.). (2001).** *A Taxonomy for Learning, Teaching, and Assessing: A Revision of Bloom's Taxonomy of Educational Objectives*. New York: Longman.

2. **Corbett, A. T., & Anderson, J. R. (1995).** Knowledge Tracing: Modeling the Acquisition of Procedural Knowledge. *User Modeling and User-Adapted Interaction, 4*(4), 253–278. [https://doi.org/10.1007/BF01099821](https://doi.org/10.1007/BF01099821)

3. **Choi, Y., Lee, Y., Shin, D., & Kim, J. (2020).** SAINT: Integrating Temporal Reasoning and Knowledge Tracing Models for Adaptive Learning on Codeforces Problems. *arXiv preprint arXiv:2008.10056*. [https://arxiv.org/abs/2008.10056](https://arxiv.org/abs/2008.10056)

4. **Liang, W., et al. (2022).** LectureBank: A Benchmark for Prerequisite Discovery from Educational Texts. *Findings of ACL 2022*. [https://aclanthology.org/2022.findings-acl.1/](https://aclanthology.org/2022.findings-acl.1/)

5. **Clement, B., Roy, D., Oudeyer, P.-Y., & Lopes, M. (2015).** Multi-Armed Bandits for Intelligent Tutoring Systems. *arXiv preprint arXiv:1310.3174*. [https://arxiv.org/abs/1310.3174](https://arxiv.org/abs/1310.3174)

6. **Van den Broeck, G., & Gybels, J. (2019).** First Acquaintance: Dueling Bandits in Online Learning. *Proceedings of the AAAI Conference on Artificial Intelligence, 33*(01), 330–336. [https://doi.org/10.1609/aaai.v33i01.3301330](https://doi.org/10.1609/aaai.v33i01.3301330)
`;

export default async function BlogPost({ params }: Props) {
  const { locale } = await params;
  const postUrl = `${siteUrl.origin}/blog/knowledge-graphs-adaptive-learning-pdfs`;
  const postTitle = "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide";
  const headings = extractHeadingsFromMarkdown(markdownContent);

  return (
    <article className="min-h-screen bg-white">
      <ReadingProgressBar />
      <JsonLd id="article-schema" data={articleSchema} />
      <JsonLd id="breadcrumb-schema" data={breadcrumbSchema} />

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
            {postTitle}
          </h1>
          <p className="text-xl text-[#414d60] leading-relaxed font-medium">
            Learn how prerequisite graphs combined with Bloom&apos;s six cognitive levels create a scientifically-grounded adaptive learning path for any PDF document.
          </p>
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-100">
            <div className="w-11 h-11 rounded-full bg-[#1d1d1f] flex items-center justify-center text-white font-bold text-sm ring-4 ring-white shadow-sm">RK</div>
            <div>
              <Link href="/blog/authors/rinkuzu-team" className="text-sm font-semibold text-[#1e242c] hover:text-teal-600 transition-colors">RinKuzu Team</Link>
              <p className="text-xs text-[#414d60]">AI Learning Platform</p>
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
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80"
              alt="Abstract knowledge graph network visualization representing interconnected learning concepts"
              width={900}
              height={500}
              className="w-full object-cover aspect-[16/9]"
              priority
            />
          </div>
        </div>

        {/* Article content — centered */}
        <div className="max-w-3xl mx-auto">
          <MarkdownRenderer content={markdownContent} />

          <ShareButtons url={postUrl} title={postTitle} />

          {/* CTA */}
          <div className="mt-16 bg-gradient-to-br from-[#1d1d1f] to-[#2d2d2f] rounded-[2rem] p-10 text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -ml-32 -mb-32"></div>
            <div className="relative z-10 text-center max-w-xl mx-auto">
              <h3 className="text-2xl md:text-3xl font-bold mb-4">See Knowledge Graphs in Action</h3>
              <p className="text-gray-300 text-lg mb-8">
                Upload a PDF and watch RinKuzu build a knowledge graph and adaptive quiz — free, in under a minute.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full bg-teal-500 text-[#1d1d1f] font-bold px-10 py-4 hover:bg-teal-400 transition-all hover:scale-105 shadow-lg shadow-teal-500/20 active:scale-95"
              >
                Get Started Free
              </Link>
              <p className="mt-4 text-xs text-gray-400">No credit card required · Free plan available</p>
            </div>
          </div>

          {/* Post navigation */}
          <div className="mt-16 pt-10 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-6">
            <Link
              href="/blog/ai-powered-quiz-generation-guide"
              className="flex flex-col gap-1 text-left group w-full sm:w-auto"
            >
              <span className="text-xs uppercase tracking-widest text-gray-400 font-bold">Previous</span>
              <span className="text-[#1d1d1f] font-bold group-hover:text-teal-600 transition-colors">
                ← How AI Transforms PDF Learning
              </span>
            </Link>
            <div className="flex flex-col gap-1 text-right w-full sm:w-auto">
              <span className="text-xs uppercase tracking-widest text-gray-400 font-bold">Next</span>
              <span className="text-gray-300">More articles coming soon</span>
            </div>
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
