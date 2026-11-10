import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GuestPdfSeoContent } from '@/features/guest-draft/components/GuestPdfSeoContent';
import { GuestPdfUploadPage } from '@/features/guest-draft/components/GuestPdfUploadPage';
import { knownGuestDraftEntry } from '@/features/guest-draft/lib/resolve-guest-entry';
import { buildLocalizedMetadata } from '@/lib/seo';
import { ROUTES } from '@/shared/constants/routes';

type SearchParams = Record<string, string | string[] | undefined>;

interface TryPdfPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ params }: TryPdfPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guestDraft.meta' });
  return {
    ...buildLocalizedMetadata({
      locale,
      path: ROUTES.TRY_PDF,
      title: t('title'),
      description: t('description'),
      robots: { index: true, follow: true },
    }),
    // Outgoing policy only: the incoming search referrer still resolves `entry=seo`.
    referrer: 'no-referrer',
  };
}

/**
 * Guest upload page (RIN-1448): public and indexable with hreflang, in the sitemap
 * (RIN-1497). `/try/pdf/play` stays `noindex`. A known `?entry=` is passed through; without
 * one the browser resolves it from the referrer at upload time. Below the widget sits the
 * server-rendered how-it-works, limits and FAQ with its `FAQPage` JSON-LD (RIN-1498).
 */
export default async function TryPdfPage({ params, searchParams }: TryPdfPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { entry } = await searchParams;
  return (
    <GuestPdfUploadPage entry={knownGuestDraftEntry(entry)}>
      <GuestPdfSeoContent locale={locale} />
    </GuestPdfUploadPage>
  );
}
