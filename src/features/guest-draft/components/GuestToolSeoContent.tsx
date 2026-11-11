import { JsonLd } from '@/components/seo/JsonLd';
import { Card } from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import { buildFaqSchema } from '@/lib/structured-data';

const SECTION_TITLE = 'text-xl font-semibold text-ink';
/** The `.card` surface (RIN-1508) with DESIGN.md padding: 16px on mobile, 20px from `sm`. */
const CARD_PADDING = 'p-4 sm:p-5';
const BODY = 'text-base leading-relaxed text-ink-muted';
const CROSS_LINK = 'inline-flex min-h-11 items-center font-medium text-brand-trust underline';

interface KeyedText {
  key: string;
}

interface GuestToolSeoCopy {
  howTitle: string;
  steps: readonly (KeyedText & { title: string; body: string })[];
  limitsTitle: string;
  limits: readonly (KeyedText & { text: string })[];
  faqTitle: string;
  faqs: readonly (KeyedText & { q: string; a: string })[];
  /** The sibling guest tool (RIN-1540): `/try/pdf` and `/try/text` link to each other. */
  crossLink: { lead: string; label: string; href: string };
}

interface GuestToolSeoContentProps {
  /** `pdf` or `text`: prefixes the section ids, test ids and the JSON-LD id. */
  tool: string;
  copy: GuestToolSeoCopy;
}

/**
 * Crawlable copy under a guest tool widget (`/try/pdf` RIN-1498, `/try/text` RIN-1540):
 * how it works, the trial limits, a link to the other tool and an FAQ. Rendered on the
 * server, so it is in the initial HTML; the `FAQPage` JSON-LD is built from the same
 * strings as the visible answers.
 */
export function GuestToolSeoContent({ tool, copy }: GuestToolSeoContentProps) {
  const id = (part: string) => `try-${tool}-${part}`;
  return (
    <div className="space-y-10 border-t border-line pt-10">
      <JsonLd id={id('faq-schema')} data={buildFaqSchema([...copy.faqs])} />

      <section aria-labelledby={id('how')} className="space-y-4">
        <h2 id={id('how')} className={SECTION_TITLE}>
          {copy.howTitle}
        </h2>
        <ol className="space-y-3">
          {copy.steps.map((step, index) => (
            <li key={step.key}>
              <Card className={`${CARD_PADDING} flex gap-4`}>
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-ink"
                >
                  {index + 1}
                </span>
                <div className="space-y-1">
                  <h3 className="font-semibold text-ink">{step.title}</h3>
                  <p className={BODY}>{step.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
        <p data-testid={id('cross-link')} className={BODY}>
          {copy.crossLink.lead}{' '}
          <Link href={copy.crossLink.href} className={CROSS_LINK}>
            {copy.crossLink.label}
          </Link>
        </p>
      </section>

      <section aria-labelledby={id('limits')} className="space-y-4">
        <h2 id={id('limits')} className={SECTION_TITLE}>
          {copy.limitsTitle}
        </h2>
        <ul data-testid={id('limits')} className={`list-disc space-y-2 pl-5 ${BODY}`}>
          {copy.limits.map((limit) => (
            <li key={limit.key}>{limit.text}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={id('faq')} className="space-y-4">
        <h2 id={id('faq')} className={SECTION_TITLE}>
          {copy.faqTitle}
        </h2>
        <ul data-testid={id('faq')} className="space-y-3">
          {copy.faqs.map((faq) => (
            <li key={faq.key}>
              <Card className={CARD_PADDING}>
                <h3 className="mb-2 font-semibold text-ink">{faq.q}</h3>
                <p className={BODY}>{faq.a}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
