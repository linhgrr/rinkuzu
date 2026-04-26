import Link from 'next/link';
import { siteUrl } from '@/lib/seo';

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  category: string;
}

const posts: BlogPost[] = [
  {
    slug: 'ai-powered-quiz-generation-guide',
    title: 'How AI Transforms PDF Learning into Adaptive Quizzes',
    description: 'Discover how large language models extract concepts from lecture PDFs and generate personalized quiz questions that adapt to each learner\'s mastery level.',
    date: 'March 27, 2026',
    readTime: '8 min read',
    category: 'AI in Education',
  },
  {
    slug: 'knowledge-graphs-adaptive-learning-pdfs',
    title: 'Knowledge Graphs and Bloom\'s Taxonomy: A Complete Guide',
    description: 'Learn how prerequisite graphs combined with Bloom\'s cognitive levels create a scientifically-grounded adaptive learning path for any PDF document.',
    date: 'March 20, 2026',
    readTime: '10 min read',
    category: 'Learning Science',
  },
];

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Blog Header */}
      <section className="bg-[var(--bg-section)] py-12 border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-8">
            <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Home</Link>
            <span>/</span>
            <span className="text-[var(--text-primary)] font-medium">Blog</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">RinKuzu Blog</h1>
          <p className="text-[var(--text-muted)] max-w-xl">
            Insights on adaptive learning, AI in education, and how to get the most from your study materials.
          </p>
        </div>
      </section>

      {/* Post List */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group rounded-3xl border border-neutral-200 overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                <div className="bg-[var(--bg-section)] border-b border-neutral-100 p-8">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-trust bg-green-50 px-3 py-1 rounded-full">
                      {post.category}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{post.date}</span>
                  </div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2 group-hover:text-brand-trust transition-colors leading-snug">
                    {post.title}
                  </h2>
                  <p className="text-[var(--text-muted)] text-sm leading-relaxed line-clamp-2">{post.description}</p>
                </div>
                <div className="px-8 py-4 flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">{post.readTime}</span>
                  <span className="text-sm font-semibold text-brand-trust group-hover:underline">Read article →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Article Content */}
      <div>{children}</div>
    </div>
  );
}
