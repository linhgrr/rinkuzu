import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/seo/JsonLd';
import { GUEST_DRAFT_LIMIT_COPY } from '@/features/guest-draft/lib/guest-limit-copy';
import { buildFaqSchema } from '@/lib/structured-data';

const STEP_KEYS = ['upload', 'generate', 'play'] as const;
const LIMIT_KEYS = ['pages', 'size', 'questions', 'kept'] as const;
const FAQ_KEYS = ['free', 'account', 'files', 'expiry', 'keep'] as const;

const SECTION_TITLE = 'text-xl font-semibold text-neutral-950';
const CARD = 'rounded-2xl border border-neutral-200 bg-white p-5';

/**
 * Crawlable copy under the `/try/pdf` upload widget (RIN-1498): how it works, the trial
 * limits and an FAQ. A server component, so it is in the initial HTML; the numbers come
 * from the guest-draft constants, and the `FAQPage` JSON-LD from the same strings as the
 * visible answers.
 */
export async function GuestPdfSeoContent({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'guestDraft' });
  const faqs = FAQ_KEYS.map((key) => ({
    key,
    q: t(`seo.faq.${key}.q`, GUEST_DRAFT_LIMIT_COPY),
    a: t(`seo.faq.${key}.a`, GUEST_DRAFT_LIMIT_COPY),
  }));

  return (
    <div className="space-y-10 border-t border-neutral-200 pt-10">
      <JsonLd id="try-pdf-faq-schema" data={buildFaqSchema(faqs)} />

      <section aria-labelledby="try-pdf-how" className="space-y-4">
        <h2 id="try-pdf-how" className={SECTION_TITLE}>
          {t('seo.howTitle')}
        </h2>
        <ol className="space-y-3">
          {STEP_KEYS.map((key, index) => (
            <li key={key} className={`${CARD} flex gap-4`}>
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-950"
              >
                {index + 1}
              </span>
              <div className="space-y-1">
                <h3 className="font-semibold text-neutral-950">{t(`seo.steps.${key}.title`)}</h3>
                <p className="text-sm leading-relaxed text-neutral-600">
                  {t(`seo.steps.${key}.body`, GUEST_DRAFT_LIMIT_COPY)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="try-pdf-limits" className="space-y-4">
        <h2 id="try-pdf-limits" className={SECTION_TITLE}>
          {t('seo.limitsTitle')}
        </h2>
        <ul
          data-testid="try-pdf-limits"
          className="list-disc space-y-2 pl-5 text-base text-neutral-600"
        >
          {LIMIT_KEYS.map((key) => (
            <li key={key}>{t(`seo.limits.${key}`, GUEST_DRAFT_LIMIT_COPY)}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="try-pdf-faq" className="space-y-4">
        <h2 id="try-pdf-faq" className={SECTION_TITLE}>
          {t('seo.faqTitle')}
        </h2>
        <ul data-testid="try-pdf-faq" className="space-y-3">
          {faqs.map((faq) => (
            <li key={faq.key} className={CARD}>
              <h3 className="mb-2 font-semibold text-neutral-950">{faq.q}</h3>
              <p className="leading-relaxed text-neutral-600">{faq.a}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
