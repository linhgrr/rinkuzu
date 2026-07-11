import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { defaultLocale } from '@/i18n/config';
import { getCurrentSession } from '@/lib/auth/session';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, session] = await Promise.all([params, getCurrentSession()]);

  if (session?.user) {
    const dashboardPath = locale === defaultLocale ? '/dashboard' : `/${locale}/dashboard`;
    redirect(dashboardPath);
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
