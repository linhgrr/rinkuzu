'use client';

import dynamic from 'next/dynamic';
import { MarkdownSkeleton } from '@/components/skeletons';

/**
 * Dynamic MarkdownRenderer - lazy loads react-markdown and remark-gfm
 * to reduce initial bundle size.
 *
 * Uses MarkdownSkeleton as loading fallback.
 */
export const DynamicMarkdownRenderer = dynamic(
  () => import('./MarkdownRenderer').then((m) => m.MarkdownRenderer),
  {
    loading: () => <MarkdownSkeleton />,
    ssr: true, // Enable SSR for SEO
  }
);
