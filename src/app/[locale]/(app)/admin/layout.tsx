import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { redirect } from '@/i18n/navigation';
import { getCurrentSession } from '@/lib/auth/session';
import { noIndexAdminMetadata } from '@/lib/seo/no-index-metadata';
import { ROUTES } from '@/shared/constants/routes';

export const metadata: Metadata = noIndexAdminMetadata;

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const [{ locale }, session] = await Promise.all([params, getCurrentSession()]);

  if (!session?.user) {
    redirect({
      href: {
        pathname: ROUTES.LOGIN,
        query: { callbackUrl: ROUTES.ADMIN.USERS },
      },
      locale,
    });
    return null;
  }

  if (session.user.role !== 'admin') {
    redirect({ href: ROUTES.HOME, locale });
  }

  return children;
}
