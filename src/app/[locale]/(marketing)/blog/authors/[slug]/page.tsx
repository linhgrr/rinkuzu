import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { buildLocalizedMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { siteUrl } from '@/lib/seo';

type Props = { params: Promise<{ locale: string; slug: string }> };

const AUTHORS: Record<string, {
  name: string;
  slug: string;
  role: string;
  bio: string;
  shortBio: string;
  imageUrl: string;
  links: { label: string; url: string }[];
}> = {
  'rinkuzu-team': {
    name: 'RinKuzu Team',
    slug: 'rinkuzu-team',
    role: 'Research & Engineering',
    bio: `The RinKuzu Team is a group of researchers and engineers at Hanoi University of Science and Technology working at the intersection of adaptive learning systems, knowledge graph construction, and educational AI. The team develops the ALSS-LEPC v2 (Adaptive Learning System with LLM-Enhanced RL for Personalized Curriculum) — an end-to-end system that transforms PDF lecture documents into personalized, knowledge-graph-driven adaptive learning paths.

The team's research combines Bayesian Knowledge Tracing, deep knowledge tracing with SAINT-Bloom models, Reinforcement Learning-based curriculum sequencing using Dueling Double DQN, and large language model-powered exercise generation to create a fully automated pipeline from document to mastery.`,
    shortBio:
      'Researchers and engineers building AI-powered adaptive learning systems from Hanoi University of Science and Technology.',
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&q=80',
    links: [],
  },
};

const AUTHOR_SLUGS = Object.keys(AUTHORS);

export async function generateStaticParams() {
  return AUTHOR_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const author = AUTHORS[slug];
  if (!author) return {};

  return buildLocalizedMetadata({
    locale,
    path: `/blog/authors/${slug}`,
    title: `${author.name} — Author at RinKuzu Blog`,
    description: author.shortBio,
  });
}

function buildPersonSchema(author: (typeof AUTHORS)[string]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    url: `${siteUrl.origin}/blog/authors/${author.slug}`,
    description: author.shortBio,
    worksFor: {
      '@type': 'Organization',
      name: 'RinKuzu / Hanoi University of Science and Technology',
      url: siteUrl.origin,
    },
    sameAs: [],
  };
}

function buildAuthorSchema(author: (typeof AUTHORS)[string]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Author',
    name: author.name,
    url: `${siteUrl.origin}/blog/authors/${author.slug}`,
    description: author.shortBio,
    image: author.imageUrl,
  };
}

export default async function AuthorPage({ params }: Props) {
  const { locale, slug } = await params;
  const author = AUTHORS[slug];
  if (!author) return null;

  const personSchema = buildPersonSchema(author);
  const authorSchema = buildAuthorSchema(author);

  return (
    <>
      <JsonLd id="person-schema" data={personSchema} />
      <JsonLd id="author-schema" data={authorSchema} />

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="bg-[#fbfbfd] py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-6">
            <nav className="flex items-center gap-2 text-sm text-[#414d60] mb-12">
              <Link href="/" className="hover:text-[#1e242c] transition-colors">Home</Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-[#1e242c] transition-colors">Blog</Link>
              <span>/</span>
              <Link href="/blog/authors" className="hover:text-[#1e242c] transition-colors">Authors</Link>
              <span>/</span>
              <span className="text-[#1e242c]">{author.name}</span>
            </nav>

            <div className="flex flex-col sm:flex-row gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden bg-gray-100 shadow-md">
                  <Image
                    src={author.imageUrl}
                    alt={`${author.name} — ${author.role}`}
                    width={144}
                    height={144}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 mb-2">
                  {author.role}
                </p>
                <h1 className="text-3xl md:text-4xl font-bold text-[#1e242c] mb-3 leading-tight">
                  {author.name}
                </h1>
                <p className="text-[#414d60] leading-relaxed text-base md:text-lg">
                  {author.shortBio}
                </p>
                {author.links.length > 0 && (
                  <div className="flex gap-3 mt-4">
                    {author.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-teal-600 hover:underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Articles by this author */}
        <section className="py-16 md:py-24">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-xl font-bold text-[#1e242c] mb-8">Articles by {author.name}</h2>
            <div className="space-y-6">
              {/* AI Quiz Generation article */}
              <Link
                href="/blog/ai-powered-quiz-generation-guide"
                className="group flex gap-5 p-5 rounded-2xl border border-gray-200 hover:border-teal-200 hover:shadow-md transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                      AI in Education
                    </span>
                    <span className="text-xs text-[#414d60]">March 27, 2026</span>
                  </div>
                  <h3 className="text-base font-semibold text-[#1e242c] group-hover:text-teal-600 transition-colors leading-snug mb-1">
                    How AI Transforms PDF Learning into Adaptive Quizzes
                  </h3>
                  <p className="text-sm text-[#414d60] leading-relaxed line-clamp-2">
                    Discover how RinKuzu&apos;s ALSS system — SAINT-Bloom, Dueling DQN, and Gemini — transforms any PDF lecture into a personalized adaptive quiz journey.
                  </p>
                </div>
              </Link>

              {/* Knowledge Graphs article */}
              <Link
                href="/blog/knowledge-graphs-adaptive-learning-pdfs"
                className="group flex gap-5 p-5 rounded-2xl border border-gray-200 hover:border-teal-200 hover:shadow-md transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                      Learning Science
                    </span>
                    <span className="text-xs text-[#414d60]">March 20, 2026</span>
                  </div>
                  <h3 className="text-base font-semibold text-[#1e242c] group-hover:text-teal-600 transition-colors leading-snug mb-1">
                    Knowledge Graphs and Bloom&apos;s Taxonomy: A Complete Guide
                  </h3>
                  <p className="text-sm text-[#414d60] leading-relaxed line-clamp-2">
                    Learn how prerequisite knowledge graphs combined with Bloom&apos;s six cognitive levels create a scientifically-grounded adaptive learning path for any PDF document.
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
