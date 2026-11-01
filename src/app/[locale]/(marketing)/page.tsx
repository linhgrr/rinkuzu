import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { GuestLanding } from '@/features/landing/components/GuestLanding';
import { buildLocalizedMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing.page.meta' });

  return buildLocalizedMetadata({
    locale,
    path: '/',
    title: t('title'),
    description: t('description'),
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <GuestLanding locale={locale} />;
}
