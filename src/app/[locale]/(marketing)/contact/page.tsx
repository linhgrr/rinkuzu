import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return buildLocalizedMetadata({
    locale,
    path: '/contact',
    title: isVi ? 'Liên hệ RinKuzu' : 'Contact Us | RinKuzu',
    description: isVi
      ? 'Liên hệ nhóm RinKuzu để được hỗ trợ về tài khoản, lỗi kỹ thuật, hợp tác giáo dục hoặc chương trình thử nghiệm.'
      : 'Contact the RinKuzu team for account support, bug reports, education partnerships, or pilot program inquiries.',
  });
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return (
    <section className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-[var(--bg-section)] border-b border-neutral-100 py-20 md:py-28">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h1 className="text-3xl md:text-5xl font-semibold text-[var(--text-primary)] mb-4">
            {isVi ? 'Liên hệ với RinKuzu' : 'Get in Touch'}
          </h1>
          <p className="text-lg text-[var(--text-muted)] leading-relaxed">
            {isVi
              ? 'Bạn có câu hỏi về RinKuzu, cần hỗ trợ tài khoản hoặc muốn trao đổi về một chương trình thử nghiệm trong giáo dục? Hãy gửi email cho chúng tôi.'
              : 'Have questions about RinKuzu, need account help, or want to discuss an education pilot? Send us an email.'}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Methods */}
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 size-10 rounded-full bg-green-50 flex items-center justify-center">
                <span className="text-brand-trust text-xs font-bold">MAIL</span>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">
                  {isVi ? 'Hỗ trợ qua email' : 'Email Support'}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  {isVi
                    ? 'Phù hợp với: câu hỏi kỹ thuật, báo lỗi và vấn đề tài khoản'
                    : 'Best for: technical questions, bug reports, and account issues'}
                </p>
                <a
                  href="mailto:support@rinkuzu.app"
                  className="text-brand-trust font-medium hover:text-brand-trust-hover hover:underline"
                >
                  support@rinkuzu.app
                </a>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 size-10 rounded-full bg-green-50 flex items-center justify-center">
                <span className="text-brand-trust text-xs font-bold">AI</span>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">
                  {isVi ? 'Trợ lý AI Rin-chan' : 'AI assistant Rin-chan'}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  {isVi
                    ? 'Dùng ngay trong nền tảng để hỏi về nội dung học và thao tác cơ bản'
                    : 'Available in the product for learning questions and common product guidance'}
                </p>
                <Link
                  href="/register"
                  className="text-brand-trust font-medium hover:text-brand-trust-hover hover:underline"
                >
                  {isVi ? 'Thử Rin-chan →' : 'Try Rin-chan →'}
                </Link>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 size-10 rounded-full bg-green-50 flex items-center justify-center">
                <span className="text-brand-trust text-xs font-bold">EDU</span>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">
                  {isVi ? 'Hợp tác giáo dục & chương trình thử nghiệm' : 'Education Partnerships'}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  {isVi
                    ? 'Trường học, giảng viên và đơn vị đào tạo có thể liên hệ để trao đổi nhu cầu và chương trình thử nghiệm phù hợp.'
                    : 'Schools, educators, and training teams can contact us to discuss their needs and a suitable pilot program.'}
                </p>
                <a
                  href="mailto:support@rinkuzu.app?subject=Educator%20Pricing%20Inquiry"
                  className="text-brand-trust font-medium hover:text-brand-trust-hover hover:underline"
                >
                  {isVi ? 'Gửi email cho nhóm →' : 'Email our team →'}
                </a>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 size-10 rounded-full bg-green-50 flex items-center justify-center">
                <span className="text-brand-trust text-xs font-bold">HQ</span>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">
                  {isVi ? 'Địa chỉ liên hệ' : 'Mailing Address'}
                </h2>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  {isVi ? 'Phòng 302, Tòa A1' : 'Room 302, Building A1'}
                  <br />
                  {isVi ? 'Đại học Bách khoa Hà Nội' : 'Hanoi University of Science and Technology'}
                  <br />
                  {isVi ? 'Số 1 Đại Cồ Việt' : 'No. 1 Dai Co Viet Street'}
                  <br />
                  {isVi ? 'Quận Hai Bà Trưng' : 'Hai Ba Trung District'}
                  <br />
                  {isVi ? 'Hà Nội, Việt Nam' : 'Hanoi, Vietnam'}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 size-10 rounded-full bg-green-50 flex items-center justify-center">
                <span className="text-brand-trust text-xs font-bold">BUG</span>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">
                  {isVi ? 'Báo lỗi' : 'Bug Reports'}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  {isVi
                    ? 'Nếu một tính năng không hoạt động như mong đợi, hãy gửi email kèm các bước tái hiện để chúng tôi kiểm tra.'
                    : "If something does not work as expected, email the steps to reproduce it and we'll investigate."}
                </p>
                <a
                  href="mailto:support@rinkuzu.app?subject=Bug%20Report"
                  className="text-brand-trust font-medium hover:text-brand-trust-hover hover:underline"
                >
                  {isVi ? 'Gửi báo lỗi →' : 'Report a bug →'}
                </a>
              </div>
            </div>
          </div>

          {/* Response Time & FAQ */}
          <div className="space-y-6">
            <div className="bg-[var(--bg-section)] rounded-2xl p-6 border border-neutral-100">
              <h2 className="font-semibold text-[var(--text-primary)] mb-4">
                {isVi ? 'Thời gian phản hồi dự kiến' : 'Expected Response Times'}
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                  <span className="text-[var(--text-muted)]">
                    {isVi ? 'Hỗ trợ qua email' : 'Email support'}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {isVi ? 'Trong 24–48 giờ' : 'Within 24–48 hours'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                  <span className="text-[var(--text-muted)]">
                    {isVi ? 'Trao đổi hợp tác giáo dục' : 'Education inquiries'}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {isVi ? 'Trong 3 ngày làm việc' : 'Within 3 business days'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                  <span className="text-[var(--text-muted)]">
                    {isVi ? 'Báo lỗi' : 'Bug reports'}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {isVi ? 'Trong 5 ngày làm việc' : 'Within 5 business days'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[var(--text-muted)]">
                    {isVi ? 'Rin-chan (trợ lý AI)' : 'Rin-chan (AI assistant)'}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {isVi ? 'Trong ứng dụng' : 'In the product'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[var(--bg-section)] rounded-2xl p-6 border border-neutral-100">
              <h2 className="font-semibold text-[var(--text-primary)] mb-4">
                {isVi ? 'Trước khi liên hệ' : 'Before You Contact Us'}
              </h2>
              <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">
                {isVi
                  ? 'Nhiều câu hỏi phổ biến đã có trong trang FAQ và thông tin sản phẩm:'
                  : 'Many common questions are covered in our FAQ and product information:'}
              </p>
              <div className="space-y-3">
                <Link
                  href="/faq"
                  className="group flex items-center justify-between rounded-xl border border-neutral-200 p-3 transition-colors hover:border-green-200 hover:bg-green-50/30"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {isVi ? 'FAQ: Câu hỏi thường gặp' : 'FAQ: Frequently Asked Questions'}
                  </span>
                  <span className="text-neutral-400 group-hover:text-brand-trust transition-colors">
                    →
                  </span>
                </Link>
                <Link
                  href="/about"
                  className="group flex items-center justify-between rounded-xl border border-neutral-200 p-3 transition-colors hover:border-green-200 hover:bg-green-50/30"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {isVi ? 'Về RinKuzu: Sản phẩm và định hướng' : 'About RinKuzu'}
                  </span>
                  <span className="text-neutral-400 group-hover:text-brand-trust transition-colors">
                    →
                  </span>
                </Link>
                <Link
                  href="/pricing"
                  className="group flex items-center justify-between rounded-xl border border-neutral-200 p-3 transition-colors hover:border-green-200 hover:bg-green-50/30"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {isVi ? 'Bảng giá: Miễn phí và Premium' : 'Pricing: Free and Premium'}
                  </span>
                  <span className="text-neutral-400 group-hover:text-brand-trust transition-colors">
                    →
                  </span>
                </Link>
              </div>
            </div>

            {/* Community CTA */}
            <div className="bg-gradient-to-br from-[var(--text-primary)] to-[#2d2d2f] rounded-2xl p-6 text-white">
              <h2 className="font-semibold mb-2">
                {isVi
                  ? 'Bắt đầu học với tài liệu của bạn'
                  : 'Start learning from your own material'}
              </h2>
              <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
                {isVi
                  ? 'Tải một file PDF lên, tạo nội dung luyện tập và xem RinKuzu gợi ý bước học tiếp theo.'
                  : 'Upload a PDF, generate practice material, and see how RinKuzu suggests the next learning step.'}
              </p>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full bg-brand-action-strong px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-action-strong-hover"
              >
                {isVi ? 'Bắt đầu miễn phí' : 'Get Started Free'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
