import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GuestPdfUploadPage } from '@/features/guest-draft/components/GuestPdfUploadPage';
import { GuestSlidesSeoContent } from '@/features/guest-draft/components/GuestSlidesSeoContent';
import { buildLocalizedMetadata } from '@/lib/seo';
import { ROUTES } from '@/shared/constants/routes';

interface TrySlidesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: TrySlidesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guestDraft.slidesMeta' });
  return {
    ...buildLocalizedMetadata({
      locale,
      path: ROUTES.TRY_SLIDES,
      title: t('title'),
      description: t('description'),
      robots: { index: true, follow: true },
    }),
    referrer: 'no-referrer',
  };
}

/**
 * Guest PowerPoint and Word page (RIN-1788): the `/try/pdf` uploader with copy that leads with
 * slides. Static like its siblings (RIN-1645): the browser reads a known `?entry=` at upload
 * time; without one the events say `try_slides`, its own row in activation by entry. Indexable
 * with hreflang and in the sitemap; below the widget sits the server-rendered how-it-works,
 * limits and FAQ with its `FAQPage` JSON-LD. A slides draft is a text draft, so it plays on
 * `/try/text/play`, which stays `noindex`.
 */
export default async function TrySlidesPage({ params }: TrySlidesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <GuestPdfUploadPage surface="try_slides">
      <GuestSlidesSeoContent locale={locale} />
    </GuestPdfUploadPage>
  );
}
