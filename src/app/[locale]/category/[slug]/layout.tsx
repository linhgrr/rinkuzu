import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const topic = humanizeSlug(slug);

  return buildLocalizedMetadata({
    locale,
    path: `/category/${slug}`,
    title: `${topic} quiz | RinKuzu`,
    description: `Tong hop quiz thuoc chu de ${topic} de ban hoc va luyen tap hieu qua.`,
  });
}

export default function CategorySlugLayout({ children }: Props) {
  return children;
}
