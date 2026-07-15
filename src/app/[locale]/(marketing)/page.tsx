import { redirect } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentSession } from '@/lib/auth/session';
import { GuestLanding } from '@/features/landing/components/GuestLanding';
import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';
import { ROUTES } from '@/shared/constants/routes';

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
    return redirect({ href: ROUTES.DASHBOARD, locale });
  }

  return <GuestLanding isAuthenticated={Boolean(session?.user)} />;
}
