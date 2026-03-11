import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/explore',
    title: 'Kham pha quiz | RinKuzu',
    description: 'Kham pha kho quiz da duoc kiem duyet theo chu de va bat dau luyen tap ngay.',
  });
}

export default function ExploreLayout({ children }: Props) {
  return children;
}
