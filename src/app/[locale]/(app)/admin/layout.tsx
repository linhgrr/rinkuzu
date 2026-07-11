import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { noIndexAdminMetadata } from '@/lib/seo/no-index-metadata';

export const metadata: Metadata = noIndexAdminMetadata;

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return children;
}
