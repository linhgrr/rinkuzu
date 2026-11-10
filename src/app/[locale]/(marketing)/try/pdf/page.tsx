import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GuestPdfUploadPage } from '@/features/guest-draft/components/GuestPdfUploadPage';
import { buildLocalizedMetadata } from '@/lib/seo';
import { GUEST_DRAFT_ENTRIES, type GuestDraftEntry } from '@/shared/constants/guest-draft';
import { ROUTES } from '@/shared/constants/routes';

type SearchParams = Record<string, string | string[] | undefined>;

interface TryPdfPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

/** Where the visitor came from (`?entry=`), carried on the guest_draft_* events. */
function entryParam(value: string | string[] | undefined): GuestDraftEntry {
  return GUEST_DRAFT_ENTRIES.find((entry) => entry === value) ?? 'landing';
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
      languageAlternates: false,
      robots: { index: false, follow: false, nocache: true },
    }),
    referrer: 'no-referrer',
  };
}

/** Guest upload page (RIN-1448): public, `noindex`, not in the sitemap. */
export default async function TryPdfPage({ params, searchParams }: TryPdfPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { entry } = await searchParams;
  return <GuestPdfUploadPage entry={entryParam(entry)} />;
}
