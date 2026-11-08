import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';

interface LearnMoreProps {
  locale: string;
}

const posts = [
  {
    slug: 'ai-powered-quiz-generation-guide',
    en: 'How AI Transforms PDF Learning into Personalized Quizzes',
    vi: 'AI biến tài liệu PDF thành quiz cá nhân hóa như thế nào?',
  },
  {
    slug: 'knowledge-graphs-adaptive-learning-pdfs',
    en: "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide",
    vi: 'Đồ thị kiến thức và phân loại Bloom: Hướng dẫn toàn diện',
  },
] as const;

export default function LearnMore({ locale }: LearnMoreProps) {
  const isVi = locale === 'vi';
  const pages = [
    { href: '/faq', label: isVi ? 'Câu hỏi thường gặp' : 'FAQ' },
    { href: '/blog', label: 'Blog' },
    { href: ROUTES.PREMIUM_QUIZZES, label: isVi ? 'Quiz premium' : 'Premium quizzes' },
  ];

  return (
    <nav
      aria-labelledby="landing-learn-more"
      className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 py-12 md:py-16"
    >
      <h2
        id="landing-learn-more"
        className="font-unbounded text-2xl font-bold text-white md:text-[32px]"
      >
        {isVi ? 'Tìm hiểu thêm' : 'Learn more'}
      </h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="block h-full rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-[#ff541b] hover:bg-white/10"
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-[#ff541b]">
                {isVi ? 'Từ blog' : 'From the blog'}
              </span>
              <span className="mt-2 block text-lg font-semibold leading-snug text-white">
                {isVi ? post.vi : post.en}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap gap-3">
        {pages.map((page) => (
          <li key={page.href}>
            <Link
              href={page.href}
              className="inline-flex rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition-colors hover:border-[#ff541b] hover:text-[#ff541b]"
            >
              {page.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
