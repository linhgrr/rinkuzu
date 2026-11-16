import type { Metadata } from 'next';
import {
  generateMetadata as exploreMetadata,
  default as ExploreLayout,
} from '@/app/[locale]/(app)/explore/layout';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Same metadata as `/explore`: canonical and hreflang stay on the public URL. */
export function generateMetadata(props: Props): Promise<Metadata> {
  return exploreMetadata(props);
}

export default function SignedOutExploreLayout(props: Props) {
  return <ExploreLayout {...props} />;
}
