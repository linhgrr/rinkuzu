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
    title: 'Danh muc chu de quiz | RinKuzu',
    description: 'Duyet toan bo danh muc chu de va tim bo quiz phu hop voi muc tieu hoc tap cua ban.',
  });
}

export default function CategoriesLayout({ children }: Props) {
  return children;
}
