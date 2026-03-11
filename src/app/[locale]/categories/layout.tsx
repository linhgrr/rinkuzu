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
    path: '/categories',
    title: 'Quiz Categories | RinKuzu',
    description: 'Explore all quiz categories and find topics that match your learning goals.',
  });
}

export default function CategoriesLayout({ children }: Props) {
  return children;
}
