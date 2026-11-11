import { getTranslations } from 'next-intl/server';
import { GuestToolSeoContent } from '@/features/guest-draft/components/GuestToolSeoContent';
import { GUEST_DRAFT_LIMIT_COPY } from '@/features/guest-draft/lib/guest-limit-copy';
import { ROUTES } from '@/shared/constants/routes';

const STEP_KEYS = ['upload', 'generate', 'play'] as const;
const LIMIT_KEYS = ['pages', 'size', 'questions', 'kept'] as const;
const FAQ_KEYS = ['free', 'account', 'files', 'expiry', 'keep'] as const;

/**
 * Crawlable copy under the `/try/pdf` upload widget (RIN-1498): how it works, the trial
 * limits, a link to `/try/text` (RIN-1540) and an FAQ. The numbers come from the
 * guest-draft constants.
 */
export async function GuestPdfSeoContent({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'guestDraft' });
  const values = GUEST_DRAFT_LIMIT_COPY;
  return (
    <GuestToolSeoContent
      tool="pdf"
      copy={{
        howTitle: t('seo.howTitle'),
        steps: STEP_KEYS.map((key) => ({
          key,
          title: t(`seo.steps.${key}.title`),
          body: t(`seo.steps.${key}.body`, values),
        })),
        limitsTitle: t('seo.limitsTitle'),
        limits: LIMIT_KEYS.map((key) => ({ key, text: t(`seo.limits.${key}`, values) })),
        faqTitle: t('seo.faqTitle'),
        faqs: FAQ_KEYS.map((key) => ({
          key,
          q: t(`seo.faq.${key}.q`, values),
          a: t(`seo.faq.${key}.a`, values),
        })),
        crossLink: {
          lead: t('seo.crossLink.lead'),
          label: t('seo.crossLink.label'),
          href: ROUTES.TRY_TEXT,
        },
      }}
    />
  );
}
