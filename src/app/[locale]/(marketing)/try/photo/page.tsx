import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GuestPhotoPage } from '@/features/guest-draft/components/GuestPhotoPage';
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
      // Not indexed until the SEO content, sitemap entry and links arrive (RIN-1795).
      robots: { index: false, follow: true },
    }),
    referrer: 'no-referrer',
  };
}

/**
 * Guest photo-to-quiz page (RIN-1793). Static like `/try/text` (RIN-1645): the browser reads
 * a known `?entry=` at submit time and the events say `try_photo` without one. `noindex`
 * and linked from nowhere yet; RIN-1795 adds the content, sitemap entry and cross-links.
 */
export default async function TryPhotoPage({ params }: TryPhotoPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GuestPhotoPage />;
}
