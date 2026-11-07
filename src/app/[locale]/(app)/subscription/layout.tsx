import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { buildLocalizedMetadata } from '@/lib/seo';
import { noIndexMetadata } from '@/lib/seo/no-index-metadata';

type LayoutMetadataProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: LayoutMetadataProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'subscription' });
  return buildLocalizedMetadata({
    locale,
    path: '/subscription',
    title: t('meta.title'),
    description: t('meta.description'),
    ...(noIndexMetadata.robots ? { robots: noIndexMetadata.robots } : {}),
  });
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
