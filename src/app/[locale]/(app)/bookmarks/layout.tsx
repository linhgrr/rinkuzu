import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { buildLocalizedMetadata } from '@/lib/seo';
import { noIndexMetadata } from '@/lib/seo/no-index-metadata';

type LayoutMetadataProps = {
  params: Promise<{ locale: string }>;
};

// RIN-1200: the tab showed the marketing title on this private page.
export async function generateMetadata({ params }: LayoutMetadataProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'profile.meta.bookmarks' });
  return buildLocalizedMetadata({
    locale,
    path: '/bookmarks',
    title: t('title'),
    description: t('description'),
    ...(noIndexMetadata.robots ? { robots: noIndexMetadata.robots } : {}),
  });
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
