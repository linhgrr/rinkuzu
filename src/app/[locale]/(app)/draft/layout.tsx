import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { noIndexMetadata } from '@/lib/seo/no-index-metadata';

export const metadata: Metadata = noIndexMetadata;

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
