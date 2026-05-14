import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buildLocalizedMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildFaqSchema } from '@/lib/structured-data';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return buildLocalizedMetadata({
    locale,
    path: '/faq',
    title: isVi ? 'Câu hỏi thường gặp | RinKuzu' : 'FAQ | RinKuzu',
    description: isVi
      ? 'Câu hỏi thường gặp về RinKuzu: tạo quiz AI từ PDF, học tập thích ứng, đồ thị kiến thức, phân loại Bloom và cách sử dụng cho học sinh, sinh viên, giáo viên.'
      : "Frequently asked questions about RinKuzu — AI quiz generator, adaptive learning, knowledge graphs, Bloom's Taxonomy, and how to use RinKuzu for students and teachers.",
    robots: { index: true, follow: true },
  });
}

function getFaqCategories(isVi: boolean) {
  return [
    {
      id: 'getting-started',
      label: isVi ? 'Bắt đầu nhanh' : 'Getting Started',
      faqs: ['1', '2', '3', '4'],
    },
    {
      id: 'ai-features',
      label: isVi ? 'AI & Học tập thích ứng' : 'AI & Adaptive Learning',
      faqs: ['5', '6', '7', '13'],
    },
    {
      id: 'platform',
      label: isVi ? 'Nền tảng & Kỹ thuật' : 'Platform & Technical',
      faqs: ['8', '9', '10', '11'],
    },
    {
      id: 'privacy-teachers',
      label: isVi ? 'Bảo mật & Giáo viên' : 'Privacy & Educators',
      faqs: ['12', '14', '15'],
    },
  ] as const;
}

export default async function FAQPage({ params }: Props) {
  const { locale } = await params;
  const isVi = locale === 'vi';
  const tLandingFaq = await getTranslations({ locale, namespace: 'landing.faq' });
  const faqs = Array.from({ length: 15 }, (_, index) => {
    const id = String(index + 1);
    return {
      q: tLandingFaq(`q${id}`),
      a: tLandingFaq(`a${id}`),
    };
  });
  const faqCategories = getFaqCategories(isVi);
  const faqIntro = isVi
    ? 'Dù bạn là học sinh, sinh viên đang ôn thi, giáo viên xây dựng bài đánh giá hay người đi làm đang nâng cao kỹ năng, RinKuzu được thiết kế để giúp bạn học nhanh hơn, thông minh hơn và cá nhân hóa hơn. Mục FAQ này giải thích từ cách AI tạo quiz từ PDF cho đến cách chúng tôi bảo vệ dữ liệu và hỗ trợ giảng dạy.'
    : "Whether you're a student preparing for exams, a teacher building assessments, or a professional upskilling, RinKuzu is designed to make learning faster, smarter, and more personal. This FAQ covers everything from how our AI generates quizzes from PDFs to how we protect your data and support educators in the classroom.";
  const faqSupportLine = isVi
    ? 'Nếu chưa thấy câu trả lời phù hợp, hãy email support@rinkuzu.app. Đội ngũ của chúng tôi sẽ phản hồi trong vòng 24-48 giờ.'
    : "If you can't find what you're looking for, email support@rinkuzu.app and our team will respond within 24-48 hours.";
  const registerHref = isVi ? '/register' : `/${locale}/register`;

  // Strip HTML tags from answers for plain-text schema
  const plainFaqs = faqs.map((f) => ({
    q: f.q,
    a: f.a.replace(/<[^>]+>/g, ''),
  }));
  const plainFaqSchema = buildFaqSchema(plainFaqs);

  return (
    <main className="min-h-screen bg-white">
      {/* FAQ JSON-LD */}
      <JsonLd id="faq-schema" data={plainFaqSchema} />

      {/* Hero */}
      <section className="bg-[var(--bg-section)] py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-4">
            {isVi ? 'Câu hỏi thường gặp' : 'Frequently Asked Questions'}
          </h1>
          <p className="text-[var(--text-muted)] text-lg">
            {isVi
              ? 'Mọi điều bạn cần biết về RinKuzu — nền tảng học tập thích ứng dùng AI từ tài liệu PDF.'
              : 'Everything you need to know about RinKuzu — AI-powered adaptive learning from PDFs.'}
          </p>
        </div>
      </section>

      {/* FAQ Categories + Intro */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        {/* Intro paragraph */}
        <div className="prose prose-slate max-w-none mb-16 text-[var(--text-muted)] leading-relaxed">
          {[faqIntro, faqSupportLine].map((para) => (
            <p key={para} className="mb-4 text-base md:text-lg">
              {para}
            </p>
          ))}
        </div>

        {/* Category Navigation */}
        <div className="flex flex-wrap gap-3 mb-12">
          {faqCategories.map((cat) => (
            <a
              key={cat.id}
              href={`#${cat.id}`}
              className="px-4 py-2 rounded-full bg-neutral-100 text-sm font-medium text-[var(--text-muted)] hover:bg-green-50 hover:text-brand-trust-hover transition-colors"
            >
              {cat.label}
            </a>
          ))}
        </div>

        {/* Category sections with anchor IDs */}
        {faqCategories.map((cat) => (
          <div key={cat.id} id={cat.id} className="mb-16">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6 pb-3 border-b border-neutral-100">
              {cat.label}
            </h2>
            <div className="space-y-4">
              {cat.faqs.map((num) => {
                const faq = faqs[parseInt(num) - 1];
                if (!faq) return null;
                return (
                  <div key={num} className="bg-neutral-50 rounded-2xl p-6">
                    <h3 className="font-semibold text-[var(--text-primary)] mb-2">{faq.q}</h3>
                    <p className="text-[var(--text-muted)] leading-relaxed">{faq.a}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="bg-[var(--text-primary)] text-white py-16 text-center">
        <div className="max-w-xl mx-auto px-6 space-y-4">
          <h2 className="text-2xl font-semibold">Still have questions?</h2>
          <p className="text-neutral-400">
            {isVi
              ? 'Trợ lý AI Rin-chan luôn sẵn sàng 24/7. Hoặc liên hệ với chúng tôi tại '
              : 'Our AI tutor Rin-chan is available 24/7. Or reach us at '}
            <a href="mailto:support@rinkuzu.app" className="underline hover:text-white">
              support@rinkuzu.app
            </a>
            .
          </p>
          <Link
            href={registerHref}
            className="inline-block bg-white text-[var(--text-primary)] font-semibold px-8 py-3 rounded-full hover:bg-neutral-100 transition-colors"
          >
            {isVi ? 'Bắt đầu miễn phí' : 'Get Started Free'}
          </Link>
        </div>
      </section>
    </main>
  );
}
