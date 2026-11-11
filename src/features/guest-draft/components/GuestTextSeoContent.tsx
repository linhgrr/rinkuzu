import { getTranslations } from 'next-intl/server';
import { GuestToolSeoContent } from '@/features/guest-draft/components/GuestToolSeoContent';
import { GUEST_DRAFT_LIMIT_COPY } from '@/features/guest-draft/lib/guest-limit-copy';
import { QUIZ_TEXT_MAX_CHARS, QUIZ_TEXT_MIN_CHARS } from '@/shared/constants/quiz-text-source';
import { ROUTES } from '@/shared/constants/routes';

const STEP_KEYS = ['paste', 'generate', 'play'] as const;
const LIMIT_KEYS = ['chars', 'questions', 'kept'] as const;
const FAQ_KEYS = ['free', 'account', 'content', 'expiry', 'keep'] as const;

/**
 * Crawlable copy under the `/try/text` widget (RIN-1540): how it works, the trial limits,
 * a link to `/try/pdf` and an FAQ with its `FAQPage` JSON-LD. The numbers come from the
 * guest-draft and pasted-text constants.
 */
export async function GuestTextSeoContent({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'guestDraft' });
  const values = { ...GUEST_DRAFT_LIMIT_COPY, min: QUIZ_TEXT_MIN_CHARS, max: QUIZ_TEXT_MAX_CHARS };
  return (
    <GuestToolSeoContent
      tool="text"
      copy={{
        howTitle: t('textSeo.howTitle'),
        steps: STEP_KEYS.map((key) => ({
          key,
          title: t(`textSeo.steps.${key}.title`),
          body: t(`textSeo.steps.${key}.body`, values),
        })),
        limitsTitle: t('textSeo.limitsTitle'),
        limits: LIMIT_KEYS.map((key) => ({ key, text: t(`textSeo.limits.${key}`, values) })),
        faqTitle: t('textSeo.faqTitle'),
        faqs: FAQ_KEYS.map((key) => ({
          key,
          q: t(`textSeo.faq.${key}.q`, values),
          a: t(`textSeo.faq.${key}.a`, values),
        })),
        crossLink: {
          lead: t('textSeo.crossLink.lead'),
          label: t('textSeo.crossLink.label'),
          href: ROUTES.TRY_PDF,
        },
      }}
    />
  );
}
