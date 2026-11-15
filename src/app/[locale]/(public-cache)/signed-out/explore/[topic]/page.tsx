import { setRequestLocale } from 'next-intl/server';
import TopicHubPage, { generateMetadata } from '@/app/[locale]/(app)/explore/[topic]/page';

// Hubs change rarely: render each on its first visit, then from the cache (RIN-1646).
export const revalidate = 600;
export const dynamicParams = true;

export function generateStaticParams(): { topic: string }[] {
  return [];
}

// Same metadata as `/explore/<topic>`: canonical stays on the public URL.
export { generateMetadata };

type Props = { params: Promise<{ locale: string; topic: string }> };

/** `/explore/<topic>` for a visitor with no session cookie, served from the cache. */
export default async function SignedOutTopicHubPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TopicHubPage params={params} />;
}
