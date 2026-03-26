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
    title: 'Explore Quizzes | RinKuzu',
    description: 'Browse curated quizzes by topic and start practicing right away.',
  });
}

export default function ExploreLayout({ children }: Props) {
  return children;
}
