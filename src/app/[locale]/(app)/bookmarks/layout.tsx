import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function BookmarksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
