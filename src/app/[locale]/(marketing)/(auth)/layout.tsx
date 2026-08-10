import type { Metadata } from 'next';
import { redirect } from '@/i18n/navigation';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { getCurrentSession } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { noIndexMetadata } from '@/lib/seo/no-index-metadata';
import { ROUTES } from '@/shared/constants/routes';

export const metadata: Metadata = noIndexMetadata;

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, session] = await Promise.all([params, getCurrentSession()]);

  if (session?.user) {
    // Unprefixed href — next-intl applies localePrefix: always.
    redirect({ href: ROUTES.DASHBOARD, locale });
  }

  return (
    <>
      <AuthShell
        locale={locale}
        googleEnabled={Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET)}
      />
      {children}
    </>
  );
}
