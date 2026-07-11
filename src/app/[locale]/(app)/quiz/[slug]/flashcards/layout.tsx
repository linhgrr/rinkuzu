import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { noIndexAllowFollowMetadata } from '@/lib/seo/no-index-metadata';

export const metadata: Metadata = noIndexAllowFollowMetadata;

export default function QuizFlashcardsLayout({ children }: { children: ReactNode }) {
  return children;
}
