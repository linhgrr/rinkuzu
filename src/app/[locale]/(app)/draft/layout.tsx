import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { noIndexMetadata } from '@/lib/seo/no-index-metadata';

type LayoutMetadataProps = {
  params: Promise<{ locale: string }>;
};

// The draft editor and its not-found page share this title; without it the tab
// showed the root marketing title (RIN-993).
export async function generateMetadata({ params }: LayoutMetadataProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'draft' });
  return { ...noIndexMetadata, title: t('meta.editTitle') };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
