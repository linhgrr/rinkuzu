import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { buildLocalizedMetadata, canonicalFor, siteUrl } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';

type Props = { params: Promise<{ locale: string; slug: string }> };

const AUTHORS: Record<
  string,
  {
    name: string;
    slug: string;
    role: string;
    bio: string;
    shortBio: string;
    imageUrl: string;
    links: { label: string; url: string }[];
  }
> = {
  'rinkuzu-team': {
    name: 'RinKuzu Team',
    slug: 'rinkuzu-team',
    role: 'Research & Engineering',
    bio: `The RinKuzu Team is a group of researchers and engineers at Hanoi University of Science and Technology working at the intersection of personalized learning systems, knowledge graph construction, and educational AI. The team develops the ALSS-LEPC v2 (Adaptive Learning System with LLM-Enhanced RL for Personalized Curriculum) — an end-to-end system that transforms PDF lecture documents into personalized, knowledge-graph-driven learning paths.

The team's research combines Bayesian Knowledge Tracing, deep knowledge tracing with SAINT-Bloom models, Reinforcement Learning-based curriculum sequencing using Dueling Double DQN, and large language model-powered exercise generation to create a fully automated pipeline from document to mastery.`,
    shortBio:
      'Researchers and engineers building AI-powered personalized learning systems from Hanoi University of Science and Technology.',
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&q=80',
    links: [],
  },
};

const AUTHOR_SLUGS = Object.keys(AUTHORS);

function localizeAuthor(author: (typeof AUTHORS)[string], locale: string) {
  if (locale !== 'vi') return author;
  return {
    ...author,
    role: 'Nghiên cứu & Kỹ thuật',
    bio: `Nhóm RinKuzu gồm các nhà nghiên cứu và kỹ sư tại Đại học Bách khoa Hà Nội, làm việc trong các lĩnh vực hệ thống học cá nhân hóa, xây dựng đồ thị kiến thức và AI giáo dục. Nhóm phát triển quy trình biến tài liệu PDF thành lộ trình luyện tập cá nhân hóa dựa trên quan hệ kiến thức.

Hệ thống kết hợp theo dõi mức độ nắm vững, sắp xếp nội dung học và tạo bài tập bằng mô hình ngôn ngữ để hỗ trợ người học đi từ tài liệu nguồn đến bước luyện tập tiếp theo.`,
    shortBio:
      'Nhóm nghiên cứu và kỹ sư phát triển hệ thống học cá nhân hóa bằng AI tại Đại học Bách khoa Hà Nội.',
  };
}

export async function generateStaticParams() {
  return AUTHOR_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const sourceAuthor = AUTHORS[slug];
  const author = sourceAuthor ? localizeAuthor(sourceAuthor, locale) : null;
  if (!author) return {};

  return buildLocalizedMetadata({
    locale,
    path: `/blog/authors/${slug}`,
    title:
      locale === 'vi'
        ? `${author.name} — Tác giả tại Blog RinKuzu`
        : `${author.name} — Author at RinKuzu Blog`,
    description: author.shortBio,
  });
}

function buildPersonSchema(author: (typeof AUTHORS)[string], locale: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    url: canonicalFor(locale, `/blog/authors/${author.slug}`),
    description: author.shortBio,
    worksFor: {
      '@type': 'Organization',
      name: 'RinKuzu / Hanoi University of Science and Technology',
      url: siteUrl.origin,
    },
  };
}

// NOTE: buildAuthorSchema removed — "@type: Author" is NOT a valid schema.org type.
// Only Person schema is used (valid per schema.org specification).
// See: https://schema.org/Person — use @type: Person for author identification.

export default async function AuthorPage({ params }: Props) {
  const { locale, slug } = await params;
  const sourceAuthor = AUTHORS[slug];
  const author = sourceAuthor ? localizeAuthor(sourceAuthor, locale) : null;
  if (!author) return null;
  const isVi = locale === 'vi';

  const personSchema = buildPersonSchema(author, locale);

  return (
    <>
      <JsonLd id="person-schema" data={personSchema} />

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="bg-[var(--bg-section)] py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-6">
            <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-12">
              <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
                {isVi ? 'Trang chủ' : 'Home'}
              </Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-[var(--text-primary)] transition-colors">
                Blog
              </Link>
              <span>/</span>
              <Link
                href="/blog/authors"
                className="hover:text-[var(--text-primary)] transition-colors"
              >
                {isVi ? 'Tác giả' : 'Authors'}
              </Link>
              <span>/</span>
              <span className="text-[var(--text-primary)]">{author.name}</span>
            </nav>

            <div className="flex flex-col sm:flex-row gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden bg-neutral-100 shadow-md">
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
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-trust mb-2">
                  {author.role}
                </p>
                <h1 className="text-3xl md:text-4xl font-semibold text-[var(--text-primary)] mb-3 leading-tight">
                  {author.name}
                </h1>
                <p className="text-[var(--text-muted)] leading-relaxed text-base md:text-lg">
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
                        className="text-sm text-brand-trust hover:underline"
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
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-8">
              {isVi ? `Bài viết của ${author.name}` : `Articles by ${author.name}`}
            </h2>
            <div className="space-y-6">
              {/* AI Quiz Generation article */}
              <Link
                href="/blog/ai-powered-quiz-generation-guide"
                className="group flex gap-5 rounded-2xl border border-neutral-200 p-5 transition-[border-color,box-shadow] hover:border-green-200 hover:shadow-md"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-trust bg-green-50 px-2 py-0.5 rounded-full">
                      {isVi ? 'AI trong giáo dục' : 'AI in Education'}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {isVi ? '27 tháng 3, 2026' : 'March 27, 2026'}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-brand-trust transition-colors leading-snug mb-1">
                    {isVi
                      ? 'AI biến tài liệu PDF thành quiz cá nhân hóa như thế nào?'
                      : 'How AI Transforms PDF Learning into Personalized Quizzes'}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed line-clamp-2">
                    {isVi
                      ? 'Tìm hiểu cách RinKuzu trích xuất khái niệm từ PDF, tạo câu hỏi và điều chỉnh nội dung luyện tập theo mức độ nắm vững.'
                      : 'Discover how RinKuzu turns PDF lectures into personalized quiz journeys.'}
                  </p>
                </div>
              </Link>

              {/* Knowledge Graphs article */}
              <Link
                href="/blog/knowledge-graphs-adaptive-learning-pdfs"
                className="group flex gap-5 rounded-2xl border border-neutral-200 p-5 transition-[border-color,box-shadow] hover:border-green-200 hover:shadow-md"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-trust bg-green-50 px-2 py-0.5 rounded-full">
                      {isVi ? 'Khoa học học tập' : 'Learning Science'}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {isVi ? '20 tháng 3, 2026' : 'March 20, 2026'}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-brand-trust transition-colors leading-snug mb-1">
                    {isVi
                      ? 'Đồ thị kiến thức và phân loại Bloom: Hướng dẫn toàn diện'
                      : "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide"}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed line-clamp-2">
                    {isVi
                      ? 'Tìm hiểu cách quan hệ tiên quyết kết hợp với sáu cấp độ Bloom để tạo lộ trình luyện tập từ tài liệu PDF.'
                      : "Learn how prerequisite knowledge graphs and Bloom's six cognitive levels shape a personalized practice path for PDF documents."}
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
