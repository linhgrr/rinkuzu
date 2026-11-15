import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GuestTextInputPage } from '@/features/guest-draft/components/GuestTextInputPage';
import { GuestTextSeoContent } from '@/features/guest-draft/components/GuestTextSeoContent';
import { buildLocalizedMetadata } from '@/lib/seo';
import { ROUTES } from '@/shared/constants/routes';

interface TryTextPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: TryTextPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guestDraft.textMeta' });
  return {
    ...buildLocalizedMetadata({
      locale,
      path: ROUTES.TRY_TEXT,
      title: t('title'),
      description: t('description'),
      robots: { index: true, follow: true },
    }),
    referrer: 'no-referrer',
  };
}

/**
 * Guest pasted-text page (RIN-1539). Static (RIN-1645): the browser reads a known `?entry=`
 * at submit time; without one the events say `try_text`, so the tool is its own row in activation by entry. Indexable with
 * hreflang and in the sitemap; below the widget sits the server-rendered how-it-works,
 * limits and FAQ with its `FAQPage` JSON-LD (RIN-1540). `/try/text/play` stays `noindex`.
 */
export default async function TryTextPage({ params }: TryTextPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <GuestTextInputPage>
      <GuestTextSeoContent locale={locale} />
    </GuestTextInputPage>
  );
}
