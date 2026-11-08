import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { buildLocalizedMetadata, siteUrl } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return buildLocalizedMetadata({
    locale,
    path: '/about',
    title: isVi ? 'Về RinKuzu — Học cá nhân hóa từ tài liệu của bạn' : 'About RinKuzu',
    description: isVi
      ? 'Tìm hiểu cách RinKuzu biến tài liệu PDF thành nội dung luyện tập, theo dõi điểm yếu và gợi ý bước học tiếp theo.'
      : 'Learn how RinKuzu turns PDF material into practice, tracks weak areas, and suggests the next learning step.',
  });
}

const teamSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About RinKuzu',
  url: `${siteUrl.origin}/about`,
  description:
    'RinKuzu is an AI-powered personalized learning platform that transforms PDF documents into quiz-based learning journeys.',
  mainEntity: {
    '@type': 'Organization',
    name: 'RinKuzu',
    url: siteUrl.origin,
    description:
      'AI-powered personalized learning platform for students, teachers, and training teams.',
    areaServed: 'Worldwide',
    knowsAbout: [
      'Personalized Learning',
      'Artificial Intelligence',
      'Educational Technology',
      'Knowledge Graphs',
      "Bloom's Taxonomy",
    ],
  },
};

const englishValues = [
  {
    icon: 'AI',
    title: 'Personalized by Design',
    body: "Every learner is unique. RinKuzu uses Bayesian Knowledge Tracing to model each student's mastery and continuously adapts the learning path to target weak spots.",
  },
  {
    icon: 'PDF',
    title: 'PDF-First',
    body: 'Your existing materials are the best study guides. Upload any lecture PDF and our AI extracts and structures the knowledge — no manual question writing needed.',
  },
  {
    icon: 'KG',
    title: 'Knowledge Graphs',
    body: 'We visualize prerequisite relationships between concepts so learners understand not just what to study, but why concepts build on each other.',
  },
  {
    icon: 'BT',
    title: "Bloom's Taxonomy",
    body: 'Practice can span six cognitive levels — from basic recall to creative synthesis — to vary the kinds of questions a learner sees.',
  },
];

const englishStats = [
  { value: '2024', label: 'Founded' },
  { value: 'AI-Powered', label: 'Core Technology' },
  { value: '2', label: 'Languages' },
  { value: '100%', label: 'Student-First' },
];

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const isVi = locale === 'vi';
  const values = isVi
    ? [
        {
          icon: 'AI',
          title: 'Cá nhân hóa theo người học',
          body: 'RinKuzu cập nhật mức độ nắm vững sau mỗi lần luyện tập để ưu tiên các khái niệm còn yếu.',
        },
        {
          icon: 'PDF',
          title: 'Bắt đầu từ PDF',
          body: 'Tải tài liệu đang học lên để trích xuất khái niệm và tạo câu hỏi mà không cần nhập lại nội dung thủ công.',
        },
        {
          icon: 'KG',
          title: 'Đồ thị kiến thức',
          body: 'Quan hệ tiên quyết giúp người học hiểu khái niệm nào cần học trước và bước tiếp theo nên là gì.',
        },
        {
          icon: 'BT',
          title: 'Phân loại Bloom',
          body: 'Bài luyện tập trải rộng từ ghi nhớ, thấu hiểu đến vận dụng và tư duy bậc cao.',
        },
      ]
    : englishValues;
  const stats = isVi
    ? [
        { value: 'PDF', label: 'Tài liệu nguồn' },
        { value: 'AI', label: 'Tạo nội dung luyện tập' },
        { value: '2', label: 'Ngôn ngữ giao diện' },
        { value: '1', label: 'Bước học tiếp theo' },
      ]
    : englishStats;

  return (
    <main className="min-h-screen bg-white">
      {/* JSON-LD */}
      <JsonLd id="about-schema" data={teamSchema} />

      {/* Hero */}
      <section className="bg-[var(--bg-section)] py-20 md:py-32 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase text-brand-trust mb-4">
            {isVi ? 'Câu chuyện của RinKuzu' : 'Our Story'}
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold text-[var(--text-primary)] mb-6 leading-tight">
            {isVi ? 'Việc học nên xoay quanh bạn,' : 'Learning Should Revolve Around You,'}
            <br />
            {isVi ? 'không phải ngược lại' : 'Not the Other Way Around'}
          </h1>
          <p className="text-lg text-[var(--text-muted)] leading-relaxed max-w-2xl mx-auto">
            {isVi
              ? 'RinKuzu giúp người học biến tài liệu đang có thành câu hỏi luyện tập, nhìn rõ phần kiến thức còn yếu và biết nên học gì tiếp theo.'
              : 'RinKuzu helps learners turn the material they already have into practice, see weak areas, and decide what to study next.'}
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold tracking-widest uppercase text-brand-trust mb-3">
              {isVi ? 'Mục tiêu của chúng tôi' : 'Our Mission'}
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold text-[var(--text-primary)] mb-6 leading-tight">
              {isVi
                ? 'Biến PDF tĩnh thành một lộ trình luyện tập'
                : 'Turning Static PDFs Into Practice Journeys'}
            </h2>
            <p className="text-[var(--text-muted)] leading-relaxed mb-4">
              {isVi
                ? 'Nhiều sinh viên đã có đầy đủ bài giảng, giáo trình và ghi chú nhưng thiếu một cách có cấu trúc để luyện tập từ chính các tài liệu đó.'
                : 'Many students already have lecture notes, textbooks, and handouts, but lack a structured way to practice from them.'}
            </p>
            <p className="text-[var(--text-muted)] leading-relaxed mb-4">
              {isVi
                ? 'RinKuzu trích xuất khái niệm từ PDF, xác định quan hệ tiên quyết và tạo câu hỏi để bạn luyện đúng phần cần cải thiện.'
                : 'RinKuzu extracts concepts from a PDF, identifies prerequisite relationships, and generates questions for the areas that need practice.'}
            </p>
            <p className="text-[var(--text-muted)] leading-relaxed">
              {isVi
                ? 'Sau mỗi câu trả lời, hệ thống cập nhật tiến độ và gợi ý nội dung phù hợp cho lượt học tiếp theo.'
                : 'After each response, the system updates progress and suggests suitable material for the next session.'}
            </p>
          </div>
          {/* Visual */}
          <div className="relative">
            <div className="overflow-hidden rounded-3xl shadow-xl">
              <Image
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80"
                alt={
                  isVi
                    ? 'Sinh viên cùng học với RinKuzu trên máy tính'
                    : 'Students studying together with RinKuzu on a laptop'
                }
                width={600}
                height={450}
                className="w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-lg px-6 py-4 border border-neutral-100">
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {isVi ? 'PDF → Luyện tập' : 'PDF → Practice'}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                {isVi ? 'Từ tài liệu đến bước học tiếp theo' : 'From source to next step'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-24 bg-[var(--bg-section)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold tracking-widest uppercase text-brand-trust mb-3">
              {isVi ? 'Nguyên tắc sản phẩm' : 'What We Stand For'}
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold text-[var(--text-primary)]">
              {isVi ? 'Cách RinKuzu hỗ trợ việc học' : 'Our Core Principles'}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {values.map((v) => (
              <div
                key={v.title}
                className="rounded-3xl bg-white border border-neutral-200 p-8 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-3xl mb-4">{v.icon}</div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-3">{v.title}</h3>
                <p className="text-[var(--text-muted)] leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 md:py-20 bg-[var(--text-primary)] text-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-3xl md:text-4xl font-bold text-white mb-1">{s.value}</p>
                <p className="text-sm text-neutral-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          {/* Visual */}
          <div className="relative order-2 md:order-1">
            <div className="overflow-hidden rounded-3xl shadow-xl">
              <Image
                src="https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80"
                alt="AI-powered personalized learning knowledge graph visualization"
                width={600}
                height={400}
                className="w-full object-cover"
              />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <p className="text-sm font-semibold tracking-widest uppercase text-brand-trust mb-3">
              {isVi ? 'Dựa trên khoa học học tập' : 'Built on Learning Science'}
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold text-[var(--text-primary)] mb-6 leading-tight">
              {isVi ? 'Theo dõi kiến thức, không chỉ điểm số' : 'Track Knowledge, Not Just Scores'}
            </h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                  Bayesian Knowledge Tracing (BKT)
                </h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                  {isVi
                    ? 'RinKuzu dùng BKT để ước lượng mức độ nắm vững từng khái niệm. Mỗi câu trả lời giúp cập nhật ước lượng này.'
                    : 'RinKuzu uses BKT to estimate mastery for each concept. Every practice response updates that estimate.'}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                  Bloom&apos;s Taxonomy (1956)
                </h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                  {isVi
                    ? 'Câu hỏi được phân theo sáu cấp độ nhận thức để kết hợp ghi nhớ nền tảng với vận dụng và tư duy bậc cao.'
                    : 'Questions span six cognitive levels to combine foundational recall with application and higher-order thinking.'}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">Knowledge Graphs</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                  {isVi
                    ? 'Các khái niệm và quan hệ tiên quyết giúp hệ thống gợi ý nội dung nên học trước và bước tiếp theo phù hợp.'
                    : 'Concepts and prerequisite relationships help the system suggest what should come first and what to study next.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-[var(--bg-section)]">
        <div className="max-w-2xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-semibold text-[var(--text-primary)]">
            {isVi
              ? 'Sẵn sàng luyện tập từ tài liệu của bạn?'
              : 'Ready to Learn from Your Material?'}
          </h2>
          <p className="text-[var(--text-muted)] text-lg">
            {isVi
              ? 'Tải một file PDF lên để tạo nội dung luyện tập và xác định bước học tiếp theo.'
              : 'Upload a PDF to generate practice material and identify the next learning step.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-[var(--text-primary)] px-8 py-3.5 font-semibold text-white transition-opacity hover:opacity-90"
            >
              {isVi ? 'Bắt đầu miễn phí' : 'Get Started Free'}
            </Link>
            <Link
              href="/adaptive"
              className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white text-[var(--text-primary)] font-semibold px-8 py-3.5 hover:bg-neutral-50 transition-colors"
            >
              {isVi ? 'Xem cách hoạt động' : 'See How It Works'}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
