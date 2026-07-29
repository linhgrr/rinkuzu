import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return buildLocalizedMetadata({
    locale,
    path: '/quizzes',
    title: isVi ? 'Thư viện quiz | RinKuzu' : 'Browse Quizzes | RinKuzu',
    description: isVi
      ? 'Khám phá quiz công khai và nội dung Premium từ cộng đồng RinKuzu để bắt đầu luyện tập.'
      : 'Browse public and Premium private quizzes from the RinKuzu community and start practicing right away.',
  });
}

export default function QuizzesLayout({ children }: Props) {
  return children;
}
