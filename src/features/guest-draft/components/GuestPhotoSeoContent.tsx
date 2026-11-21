import { getTranslations } from 'next-intl/server';
import { GuestToolSeoContent } from '@/features/guest-draft/components/GuestToolSeoContent';
import { GUEST_DRAFT_LIMIT_COPY } from '@/features/guest-draft/lib/guest-limit-copy';
import {
  QUIZ_IMAGE_MAX_COUNT,
  QUIZ_IMAGE_MAX_INPUT_BYTES,
} from '@/features/quiz-images/lib/prepare-quiz-image';
import { ROUTES } from '@/shared/constants/routes';

const STEP_KEYS = ['snap', 'generate', 'play'] as const;
const LIMIT_KEYS = ['count', 'size', 'questions', 'kept'] as const;
const FAQ_KEYS = ['free', 'account', 'best', 'handwriting', 'privacy', 'keep'] as const;

/**
 * Crawlable copy under the `/try/photo` widget (RIN-1795): how it works, the trial limits,
 * links to `/try/pdf`, `/try/text` and `/try/slides`, and an FAQ with its `FAQPage` JSON-LD.
 * The numbers come from the guest-draft and photo-picker constants. The privacy answer makes
 * no claim about how long the text-recognition provider keeps a photo (design review RIN-1835).
 */
export async function GuestPhotoSeoContent({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'guestDraft' });
  const values = {
    ...GUEST_DRAFT_LIMIT_COPY,
    count: QUIZ_IMAGE_MAX_COUNT,
    mb: QUIZ_IMAGE_MAX_INPUT_BYTES / (1024 * 1024),
  };
  return (
    <GuestToolSeoContent
      tool="photo"
      copy={{
        howTitle: t('photoSeo.howTitle'),
        steps: STEP_KEYS.map((key) => ({
          key,
          title: t(`photoSeo.steps.${key}.title`),
          body: t(`photoSeo.steps.${key}.body`, values),
        })),
        limitsTitle: t('photoSeo.limitsTitle'),
        limits: LIMIT_KEYS.map((key) => ({ key, text: t(`photoSeo.limits.${key}`, values) })),
        faqTitle: t('photoSeo.faqTitle'),
        faqs: FAQ_KEYS.map((key) => ({
          key,
          q: t(`photoSeo.faq.${key}.q`, values),
          a: t(`photoSeo.faq.${key}.a`, values),
        })),
        crossLink: {
          lead: t('photoSeo.crossLink.lead'),
          label: t('photoSeo.crossLink.label'),
          href: ROUTES.TRY_PDF,
        },
        moreLink: {
          lead: t('photoSeo.textLink.lead'),
          label: t('photoSeo.textLink.label'),
          href: ROUTES.TRY_TEXT,
        },
        extraLink: {
          lead: t('photoSeo.slidesLink.lead'),
          label: t('photoSeo.slidesLink.label'),
          href: ROUTES.TRY_SLIDES,
        },
      }}
    />
  );
}
