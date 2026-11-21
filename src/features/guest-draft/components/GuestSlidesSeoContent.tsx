import { getTranslations } from 'next-intl/server';
import { GuestToolSeoContent } from '@/features/guest-draft/components/GuestToolSeoContent';
import { GUEST_DRAFT_LIMIT_COPY } from '@/features/guest-draft/lib/guest-limit-copy';
import { QUIZ_TEXT_MAX_CHARS } from '@/shared/constants/quiz-text-source';
import { ROUTES } from '@/shared/constants/routes';

const STEP_KEYS = ['upload', 'generate', 'play'] as const;
const LIMIT_KEYS = ['size', 'chars', 'questions', 'kept'] as const;
const FAQ_KEYS = ['free', 'account', 'read', 'expiry', 'keep'] as const;

/**
 * Crawlable copy under the `/try/slides` widget (RIN-1788): what is read from a PowerPoint or
 * Word file, the trial limits, links to `/try/pdf` and `/try/text` and an FAQ with its
 * `FAQPage` JSON-LD. The numbers come from the guest-draft and pasted-text constants.
 */
export async function GuestSlidesSeoContent({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'guestDraft' });
  const values = { ...GUEST_DRAFT_LIMIT_COPY, max: QUIZ_TEXT_MAX_CHARS };
  return (
    <GuestToolSeoContent
      tool="slides"
      copy={{
        howTitle: t('slidesSeo.howTitle'),
        steps: STEP_KEYS.map((key) => ({
          key,
          title: t(`slidesSeo.steps.${key}.title`),
          body: t(`slidesSeo.steps.${key}.body`, values),
        })),
        limitsTitle: t('slidesSeo.limitsTitle'),
        limits: LIMIT_KEYS.map((key) => ({ key, text: t(`slidesSeo.limits.${key}`, values) })),
        faqTitle: t('slidesSeo.faqTitle'),
        faqs: FAQ_KEYS.map((key) => ({
          key,
          q: t(`slidesSeo.faq.${key}.q`, values),
          a: t(`slidesSeo.faq.${key}.a`, values),
        })),
        crossLink: {
          lead: t('slidesSeo.crossLink.lead'),
          label: t('slidesSeo.crossLink.label'),
          href: ROUTES.TRY_PDF,
        },
        moreLink: {
          lead: t('slidesSeo.textLink.lead'),
          label: t('slidesSeo.textLink.label'),
          href: ROUTES.TRY_TEXT,
        },
      }}
    />
  );
}
