import type { Metadata } from 'next';
import {
  generateMetadata as premiumQuizzesMetadata,
  default as PremiumQuizzesLayout,
} from '@/app/[locale]/(app)/premium-quizzes/layout';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Same metadata as `/premium-quizzes`: canonical and hreflang stay on the public URL. */
export function generateMetadata(props: Props): Promise<Metadata> {
  return premiumQuizzesMetadata(props);
}

export default function SignedOutPremiumQuizzesLayout(props: Props) {
  return <PremiumQuizzesLayout {...props} />;
}
