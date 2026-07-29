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
    path: '/cookies',
    title: isVi ? 'Chính sách cookie | RinKuzu' : 'Cookie Policy | RinKuzu',
    description: isVi
      ? 'Tìm hiểu cách RinKuzu sử dụng cookie cần thiết và cookie phân tích để vận hành, bảo vệ và cải thiện sản phẩm.'
      : 'How RinKuzu uses essential and analytics cookies to operate, protect, and improve the product.',
  });
}

export default async function CookiesPage({ params }: Props) {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return (
    <section className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-3xl font-semibold text-neutral-900">
        {isVi ? 'Chính sách cookie' : 'Cookie Policy'}
      </h1>
      <p className="text-neutral-600">
        {isVi
          ? 'RinKuzu sử dụng cookie để duy trì phiên đăng nhập, bảo vệ tài khoản, đo lường hiệu năng khi bạn đồng ý và cải thiện trải nghiệm học tập.'
          : 'RinKuzu uses cookies to maintain sessions, protect accounts, measure performance with your consent, and improve the learning experience.'}
      </p>
      <h2 className="text-xl font-semibold text-neutral-900">
        {isVi ? 'Các loại cookie' : 'Cookie types'}
      </h2>
      <ul className="text-neutral-600 space-y-1">
        <li>
          -{' '}
          {isVi
            ? 'Cookie thiết yếu phục vụ xác thực, bảo mật và duy trì phiên.'
            : 'Essential cookies for authentication, security, and session continuity.'}
        </li>
        <li>
          -{' '}
          {isVi
            ? 'Cookie phân tích chỉ được dùng khi có sự đồng ý để hiểu hiệu năng sản phẩm.'
            : 'Analytics cookies, used with consent, to understand product performance.'}
        </li>
      </ul>
    </section>
  );
}
