import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GuestPhotoPage } from '@/features/guest-draft/components/GuestPhotoPage';
import { GuestPhotoSeoContent } from '@/features/guest-draft/components/GuestPhotoSeoContent';
import { buildLocalizedMetadata } from '@/lib/seo';
import { ROUTES } from '@/shared/constants/routes';

interface TryPhotoPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: TryPhotoPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guestDraft.photoMeta' });
  return {
    ...buildLocalizedMetadata({
      locale,
      path: ROUTES.TRY_PHOTO,
      title: t('title'),
      description: t('description'),
      robots: { index: true, follow: true },
    }),
    referrer: 'no-referrer',
  };
}

/**
 * Guest photo-to-quiz page (RIN-1793, indexable since RIN-1795). Static like `/try/text`
 * (RIN-1645): the browser reads a known `?entry=` at submit time and the events say
 * `try_photo` without one. Indexable with hreflang and in the sitemap; below the widget sits
 * the server-rendered how-it-works, limits and FAQ with its `FAQPage` JSON-LD. A photo draft
 * plays on `/try/photo/play`, which stays `noindex`.
 */
export default async function TryPhotoPage({ params }: TryPhotoPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <GuestPhotoPage>
      <GuestPhotoSeoContent locale={locale} />
    </GuestPhotoPage>
  );
}
