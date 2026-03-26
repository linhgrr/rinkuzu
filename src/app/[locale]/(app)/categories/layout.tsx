import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildBreadcrumbSchema } from '@/lib/structured-data';

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

export default async function CategoriesLayout({ children, params }: Props) {
  const { locale } = await params;
  const breadcrumbSchema = buildBreadcrumbSchema(locale, [
    { name: 'Home', path: '/' },
    { name: 'Categories', path: '/categories' },
  ]);

  return (
    <>
      <JsonLd id="categories-breadcrumb-schema" data={breadcrumbSchema} />
      {children}
    </>
  );
}
