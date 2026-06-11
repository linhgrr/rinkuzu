import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/AuthShell';
import { isGoogleLoginEnabled } from '@/lib/auth';

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
  const { locale } = await params;

  return (
    <>
      <AuthShell locale={locale} googleEnabled={isGoogleLoginEnabled} />
      {children}
    </>
  );
}
