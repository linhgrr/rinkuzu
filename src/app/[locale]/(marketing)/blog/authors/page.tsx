import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/blog/authors',
    title: 'Blog Authors — RinKuzu',
    description: 'Meet the researchers and engineers behind the RinKuzu Blog — writing about adaptive learning, AI in education, knowledge graphs, and Bloom\'s Taxonomy.',
  });
}

const authors = [
  {
    name: 'RinKuzu Team',
    slug: 'rinkuzu-team',
    role: 'Research & Engineering',
    shortBio: 'Researchers and engineers building AI-powered adaptive learning systems from Hanoi University of Science and Technology.',
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&q=80',
  },
];

export default async function AuthorsPage({ params }: Props) {
  const { locale } = await params;

  return (
    <main className="min-h-screen bg-white">
      <header className="bg-[#fbfbfd] border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-12">
          <nav className="flex items-center gap-2 text-sm text-[#414d60] mb-8">
            <Link href="/" className="hover:text-[#1e242c] transition-colors">Home</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-[#1e242c] transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-[#1e242c]">Authors</span>
          </nav>
          <h1 className="text-3xl md:text-5xl font-bold text-[#1e242c] leading-tight mb-4">
            Authors
          </h1>
          <p className="text-lg text-[#414d60] leading-relaxed">
            Meet the researchers and engineers writing about adaptive learning and AI in education.
          </p>
        </div>
      </header>

      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 gap-6">
            {authors.map((author) => (
              <Link
                key={author.slug}
                href={`/blog/authors/${author.slug}`}
                className="group rounded-3xl border border-gray-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="relative h-40 overflow-hidden bg-gray-50">
                  <Image
                    src={author.imageUrl}
                    alt={author.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, 340px"
                  />
                </div>
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 mb-1">
                    {author.role}
                  </p>
                  <h2 className="text-lg font-bold text-[#1e242c] mb-2 group-hover:text-teal-600 transition-colors">
                    {author.name}
                  </h2>
                  <p className="text-sm text-[#414d60] leading-relaxed">
                    {author.shortBio}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
