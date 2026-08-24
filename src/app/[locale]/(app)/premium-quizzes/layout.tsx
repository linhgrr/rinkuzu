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
    path: '/premium-quizzes',
    title: isVi ? 'Kho Quiz Premium | RinKuzu' : 'Quiz Premium Catalog | RinKuzu',
    description: isVi
      ? 'Khám phá kho quiz tuyển chọn đã được duyệt chất lượng trên RinKuzu.'
      : 'Explore RinKuzu’s curated, quality-reviewed Quiz Premium catalog.',
  });
}

export default function PremiumQuizzesLayout({ children }: Props) {
  return children;
}
