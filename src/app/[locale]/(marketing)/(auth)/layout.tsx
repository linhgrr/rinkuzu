import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { authOptions, isGoogleLoginEnabled } from '@/lib/auth';
import { toBrowserPath } from '@/lib/routing/pathname';
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
  const [{ locale }, session] = await Promise.all([params, getServerSession(authOptions)]);

  if (session?.user) {
    redirect(toBrowserPath(ROUTES.DASHBOARD, locale));
  }

  return (
    <>
      <AuthShell locale={locale} googleEnabled={isGoogleLoginEnabled} />
      {children}
    </>
  );
}
