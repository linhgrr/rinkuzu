import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/blog',
    title: 'RinKuzu Blog — Adaptive Learning, AI in Education & Knowledge Graphs',
    description:
      "Insights on AI-powered adaptive learning, knowledge graph construction, Bloom's Taxonomy in practice, and how RinKuzu transforms any PDF into a personalized study path.",
  });
}

const posts = [
  {
    slug: 'ai-powered-quiz-generation-guide',
    title: 'How AI Transforms PDF Learning into Adaptive Quizzes',
    description:
      "Discover how RinKuzu uses large language models, knowledge graphs, and Bayesian Knowledge Tracing to extract concepts from lecture PDFs and generate personalized quiz questions that adapt to each learner's mastery level.",
    date: 'March 27, 2026',
    dateIso: '2026-03-27',
    readTime: '8 min read',
    category: 'AI in Education',
    image: 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=800&q=80',
    imageAlt:
      'Open textbook with highlighted notes beside a laptop showing an AI learning interface',
  },
  {
    slug: 'knowledge-graphs-adaptive-learning-pdfs',
    title: "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide",
    description:
      "Learn how prerequisite knowledge graphs combined with Bloom's six cognitive levels create a scientifically-grounded adaptive learning path for any PDF document — backed by SAINT-Bloom knowledge tracing and D3QN curriculum planning.",
    date: 'March 20, 2026',
    dateIso: '2026-03-20',
    readTime: '10 min read',
    category: 'Learning Science',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
    imageAlt:
      'Abstract knowledge graph network visualization representing interconnected learning concepts',
  },
];

export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params;
  void locale;

  return (
    <article className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-[var(--bg-section)] border-b border-neutral-100">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-12">
          <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-8">
            <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-[var(--text-primary)] font-medium">Blog</span>
          </nav>
          <h1 className="text-3xl md:text-5xl font-semibold text-[var(--text-primary)] leading-tight mb-4">
            RinKuzu Blog
          </h1>
          <p className="text-lg text-[var(--text-muted)] leading-relaxed max-w-2xl">
            Insights on adaptive learning, AI in education, knowledge graphs, and how RinKuzu
            transforms any PDF lecture into a personalized study journey.
          </p>
        </div>
      </header>

      {/* Post list */}
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block rounded-3xl overflow-hidden border border-neutral-200 transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-xl"
          >
            {/* Thumbnail */}
            <div className="relative aspect-[16/7] overflow-hidden bg-neutral-50">
              <Image
                src={post.image}
                alt={post.imageAlt}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 720px"
              />
            </div>

            {/* Card body */}
            <div className="p-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-trust bg-green-50 px-3 py-1 rounded-full">
                  {post.category}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {post.date} · {post.readTime}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-[var(--text-primary)] mb-3 group-hover:text-brand-trust transition-colors leading-snug">
                {post.title}
              </h2>
              <p className="text-[var(--text-muted)] leading-relaxed line-clamp-3 mb-4">
                {post.description}
              </p>
              <span className="text-sm font-semibold text-brand-trust group-hover:underline">
                Read article →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </article>
  );
}
