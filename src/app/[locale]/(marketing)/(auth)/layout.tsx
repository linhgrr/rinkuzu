import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { defaultLocale } from '@/i18n/config';
import { authOptions, isGoogleLoginEnabled } from '@/lib/auth';

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
  const [{ locale }, session] = await Promise.all([params, getServerSession(authOptions)]);

  if (session?.user) {
    const dashboardPath = locale === defaultLocale ? '/dashboard' : `/${locale}/dashboard`;
    redirect(dashboardPath);
  }

  return (
    <>
      <AuthShell locale={locale} googleEnabled={isGoogleLoginEnabled} />
      {children}
    </>
  );
}
