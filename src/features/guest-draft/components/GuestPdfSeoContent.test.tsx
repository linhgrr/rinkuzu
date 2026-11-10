/** @vitest-environment jsdom */

import { createTranslator } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../messages/en/guestDraft.json';
import viGuest from '../../../../messages/vi/guestDraft.json';
import {
  GUEST_DRAFT_MAX_PAGES,
  GUEST_DRAFT_MAX_PDF_BYTES,
  GUEST_DRAFT_MAX_QUESTIONS,
  GUEST_DRAFT_TTL_MS,
} from '@/shared/constants/guest-draft';

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({
      locale,
      messages: { guestDraft: locale === 'vi' ? viGuest : enGuest },
      namespace: namespace as 'guestDraft',
    }),
}));

import { GuestPdfSeoContent } from './GuestPdfSeoContent';

const LOCALES = ['vi', 'en'] as const;

/** The server HTML, parsed: what a crawler sees without running any JS. */
async function serverHtml(locale: string): Promise<Document> {
  const html = renderToStaticMarkup(await GuestPdfSeoContent({ locale }));
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

function text(nodes: NodeListOf<Element>): string[] {
  return Array.from(nodes, (node) => node.textContent ?? '');
}

describe('GuestPdfSeoContent (RIN-1498)', () => {
  it.each(LOCALES)(
    'renders how it works, the limits and the FAQ on the server in %s',
    async (l) => {
      const doc = await serverHtml(l);
      const headings = text(doc.querySelectorAll('h2'));
      const seo = (l === 'vi' ? viGuest : enGuest).seo;
      expect(headings).toEqual([seo.howTitle, seo.limitsTitle, seo.faqTitle]);
      expect(doc.querySelectorAll('ol > li')).toHaveLength(3);
      const faqs = doc.querySelectorAll('[data-testid="try-pdf-faq"] h3');
      expect(faqs.length).toBeGreaterThanOrEqual(4);
      expect(faqs.length).toBeLessThanOrEqual(6);
      // No JS accordion: every answer is in the markup, not behind a client toggle.
      expect(doc.querySelectorAll('[data-testid="try-pdf-faq"] p')).toHaveLength(faqs.length);
    },
  );

  it.each(LOCALES)('states the limits from the shared constants in %s', async (l) => {
    const doc = await serverHtml(l);
    const limits = text(doc.querySelectorAll('[data-testid="try-pdf-limits"] li')).join(' | ');
    for (const value of [
      GUEST_DRAFT_MAX_PAGES,
      GUEST_DRAFT_MAX_PDF_BYTES / (1024 * 1024),
      GUEST_DRAFT_MAX_QUESTIONS,
      GUEST_DRAFT_TTL_MS / 3_600_000,
    ]) {
      expect(limits).toMatch(new RegExp(`\\b${value}\\b`));
    }
    expect(doc.body.innerHTML).not.toMatch(/\{(pages|mb|questions|hours)\}/);
  });

  it.each(LOCALES)('emits FAQPage JSON-LD equal to the visible Q&A in %s', async (l) => {
    const doc = await serverHtml(l);
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    const schema = JSON.parse(scripts[0]?.textContent ?? '{}');
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('FAQPage');
    const visible = Array.from(doc.querySelectorAll('[data-testid="try-pdf-faq"] li'), (item) => ({
      '@type': 'Question',
      name: item.querySelector('h3')?.textContent,
      acceptedAnswer: { '@type': 'Answer', text: item.querySelector('p')?.textContent },
    }));
    expect(visible.length).toBeGreaterThanOrEqual(4);
    expect(schema.mainEntity).toEqual(visible);
  });

  it.each(LOCALES)('uses the personalized wording, never adaptive, in %s', async (l) => {
    const doc = await serverHtml(l);
    expect(doc.body.textContent).not.toMatch(/adaptive|thích ứng/i);
  });
});
