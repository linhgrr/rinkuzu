import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return buildLocalizedMetadata({
    locale,
    path: '/blog',
    title: isVi
      ? 'Blog RinKuzu — Học thích ứng, AI giáo dục và đồ thị kiến thức'
      : 'RinKuzu Blog — Adaptive Learning, AI in Education & Knowledge Graphs',
    description: isVi
      ? 'Bài viết về học thích ứng, xây dựng đồ thị kiến thức, phân loại Bloom và cách biến tài liệu PDF thành lộ trình luyện tập cá nhân hóa.'
      : "Insights on adaptive learning, knowledge graph construction, Bloom's Taxonomy in practice, and turning PDFs into personalized practice paths.",
  });
}

const englishPosts = [
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
      "Learn how prerequisite knowledge graphs and Bloom's cognitive levels can structure adaptive practice from supported PDF material.",
    date: 'March 20, 2026',
    dateIso: '2026-03-20',
    readTime: '10 min read',
    category: 'Learning Science',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
    imageAlt:
      'Abstract knowledge graph network visualization representing interconnected learning concepts',
  },
];

const vietnamesePosts = [
  {
    ...englishPosts[0],
    title: 'AI biến tài liệu PDF thành quiz thích ứng như thế nào?',
    description:
      'Tìm hiểu cách RinKuzu trích xuất khái niệm từ PDF bài giảng, tạo câu hỏi luyện tập và điều chỉnh nội dung theo mức độ nắm vững của người học.',
    date: '27 tháng 3, 2026',
    readTime: '8 phút đọc',
    category: 'AI trong giáo dục',
    imageAlt: 'Giáo trình mở có ghi chú bên cạnh máy tính hiển thị giao diện học tập bằng AI',
  },
  {
    ...englishPosts[1],
    title: 'Đồ thị kiến thức và phân loại Bloom: Hướng dẫn toàn diện',
    description:
      'Tìm hiểu cách quan hệ tiên quyết giữa các khái niệm kết hợp với sáu cấp độ nhận thức Bloom để tạo lộ trình luyện tập từ tài liệu PDF.',
    date: '20 tháng 3, 2026',
    readTime: '10 phút đọc',
    category: 'Khoa học học tập',
    imageAlt: 'Minh họa mạng lưới đồ thị kiến thức gồm các khái niệm học tập liên kết',
  },
];

export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params;
  const isVi = locale === 'vi';
  const posts = isVi ? vietnamesePosts : englishPosts;

  return (
    <article className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-[var(--bg-section)] border-b border-neutral-100">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-12">
          <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-8">
            <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
              {isVi ? 'Trang chủ' : 'Home'}
            </Link>
            <span>/</span>
            <span className="text-[var(--text-primary)] font-medium">Blog</span>
          </nav>
          <h1 className="text-3xl md:text-5xl font-semibold text-[var(--text-primary)] leading-tight mb-4">
            RinKuzu Blog
          </h1>
          <p className="text-lg text-[var(--text-muted)] leading-relaxed max-w-2xl">
            {isVi
              ? 'Kiến thức thực tiễn về học thích ứng, AI trong giáo dục, đồ thị kiến thức và cách biến PDF bài giảng thành lộ trình luyện tập cá nhân hóa.'
              : 'Insights on adaptive learning, AI in education, knowledge graphs, and turning PDF lectures into personalized practice journeys.'}
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
                {isVi ? 'Đọc bài viết →' : 'Read article →'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </article>
  );
}
