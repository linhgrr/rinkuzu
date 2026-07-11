import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { defaultLocale } from '@/i18n/config';
import { GuestLanding } from '@/features/landing/components/GuestLanding';
import type { Metadata } from 'next';
import { getCurrentSession } from '@/lib/auth/session';
import { buildLocalizedMetadata } from '@/lib/seo';

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
  const [{ locale }, session] = await Promise.all([params, getCurrentSession()]);

  if (session?.user) {
    const dashboardPath = locale === defaultLocale ? '/dashboard' : `/${locale}/dashboard`;
    redirect(dashboardPath);
  }

  return <GuestLanding isAuthenticated={Boolean(session?.user)} />;
}
