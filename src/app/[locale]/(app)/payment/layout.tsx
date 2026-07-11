import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { noIndexNoNocacheMetadata } from '@/lib/seo/no-index-metadata';

export const metadata: Metadata = noIndexNoNocacheMetadata;

export default function PaymentLayout({ children }: { children: ReactNode }) {
  return children;
}
