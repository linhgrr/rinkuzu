/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes } from 'react';
import { createTranslator } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../messages/en/guestDraft.json';
import viGuest from '../../../../messages/vi/guestDraft.json';
import {
  QUIZ_IMAGE_MAX_COUNT,
  QUIZ_IMAGE_MAX_INPUT_BYTES,
} from '@/features/quiz-images/lib/prepare-quiz-image';
import { OFFICE_MAX_FILE_BYTES } from '@/lib/office-text/types';
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
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

import { GuestPdfSeoContent } from './GuestPdfSeoContent';
import { GuestPhotoSeoContent } from './GuestPhotoSeoContent';
import { GuestSlidesSeoContent } from './GuestSlidesSeoContent';
import { GuestTextSeoContent } from './GuestTextSeoContent';

const LOCALES = ['vi', 'en'] as const;
type Locale = (typeof LOCALES)[number];

const TOOLS = [
  {
    tool: 'pdf',
    issue: 'RIN-1498',
    Component: GuestPdfSeoContent,
    seo: (l: Locale) => (l === 'vi' ? viGuest : enGuest).seo,
    limits: () => [
      String(GUEST_DRAFT_MAX_PAGES),
      String(GUEST_DRAFT_MAX_PDF_BYTES / (1024 * 1024)),
      String(GUEST_DRAFT_MAX_QUESTIONS),
      String(GUEST_DRAFT_TTL_MS / 3_600_000),
    ],
    otherTool: '/try/text',
    moreTool: '/try/slides',
    moreLabel: (l: Locale) => (l === 'vi' ? viGuest : enGuest).seo.slidesLink.label,
    extraLabel: (l: Locale) => (l === 'vi' ? viGuest : enGuest).seo.photoLink.label,
  },
  {
    tool: 'text',
    issue: 'RIN-1540',
    Component: GuestTextSeoContent,
    seo: (l: Locale) => (l === 'vi' ? viGuest : enGuest).textSeo,
    // The spec's 200 to 20,000 characters, as each locale formats the number.
    limits: (l: Locale) => [
      '200',
      l === 'vi' ? '20.000' : '20,000',
      String(GUEST_DRAFT_MAX_QUESTIONS),
      String(GUEST_DRAFT_TTL_MS / 3_600_000),
    ],
    otherTool: '/try/pdf',
    moreTool: '/try/slides',
    moreLabel: (l: Locale) => (l === 'vi' ? viGuest : enGuest).textSeo.slidesLink.label,
    extraLabel: (l: Locale) => (l === 'vi' ? viGuest : enGuest).textSeo.photoLink.label,
  },
  {
    tool: 'slides',
    issue: 'RIN-1788',
    Component: GuestSlidesSeoContent,
    seo: (l: Locale) => (l === 'vi' ? viGuest : enGuest).slidesSeo,
    // 20 MB per file and the first 20,000 characters, as each locale formats the number.
    limits: (l: Locale) => [
      String(OFFICE_MAX_FILE_BYTES / (1024 * 1024)),
      l === 'vi' ? '20.000' : '20,000',
      String(GUEST_DRAFT_MAX_QUESTIONS),
      String(GUEST_DRAFT_TTL_MS / 3_600_000),
    ],
    otherTool: '/try/pdf',
    moreTool: '/try/text',
    moreLabel: (l: Locale) => (l === 'vi' ? viGuest : enGuest).slidesSeo.textLink.label,
    extraLabel: (l: Locale) => (l === 'vi' ? viGuest : enGuest).slidesSeo.photoLink.label,
  },
  {
    tool: 'photo',
    issue: 'RIN-1795',
    Component: GuestPhotoSeoContent,
    seo: (l: Locale) => (l === 'vi' ? viGuest : enGuest).photoSeo,
    // Up to 5 photos of up to 10 MB each, 10 questions, kept 24 hours.
    limits: () => [
      String(QUIZ_IMAGE_MAX_COUNT),
      String(QUIZ_IMAGE_MAX_INPUT_BYTES / (1024 * 1024)),
      String(GUEST_DRAFT_MAX_QUESTIONS),
      String(GUEST_DRAFT_TTL_MS / 3_600_000),
    ],
    otherTool: '/try/pdf',
    moreTool: '/try/text',
    moreLabel: (l: Locale) => (l === 'vi' ? viGuest : enGuest).photoSeo.textLink.label,
    extraLabel: (l: Locale) => (l === 'vi' ? viGuest : enGuest).photoSeo.slidesLink.label,
  },
] as const;

/** The sibling every tool links to as its third sentence: the photo tool, or slides from it (RIN-1795). */
const EXTRA_TOOL: Record<string, string> = {
  pdf: '/try/photo',
  text: '/try/photo',
  slides: '/try/photo',
  photo: '/try/slides',
};

const CASES = TOOLS.flatMap((tool) => LOCALES.map((locale) => ({ ...tool, locale })));

describe.each(CASES)('$tool SEO content in $locale ($issue)', (c) => {
  const id = (part: string) => `try-${c.tool}-${part}`;
  const faqSelector = `[data-testid="${id('faq')}"]`;

  /** The server HTML, parsed: what a crawler sees without running any JS. */
  async function serverHtml(): Promise<Document> {
    const html = renderToStaticMarkup(await c.Component({ locale: c.locale }));
    return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  }

  it('renders how it works, the limits and the FAQ on the server', async () => {
    const doc = await serverHtml();
    const seo = c.seo(c.locale);
    expect(Array.from(doc.querySelectorAll('h2'), (h) => h.textContent)).toEqual([
      seo.howTitle,
      seo.limitsTitle,
      seo.faqTitle,
    ]);
    expect(doc.querySelectorAll('ol > li')).toHaveLength(3);
    const faqs = doc.querySelectorAll(`${faqSelector} h3`);
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs.length).toBeLessThanOrEqual(6);
    // No JS accordion: every answer is in the markup, not behind a client toggle.
    expect(doc.querySelectorAll(`${faqSelector} p`)).toHaveLength(faqs.length);
  });

  it('states the limits from the shared constants', async () => {
    const doc = await serverHtml();
    const limits = Array.from(
      doc.querySelectorAll(`[data-testid="${id('limits')}"] li`),
      (li) => li.textContent,
    ).join(' | ');
    for (const value of c.limits(c.locale)) {
      expect(limits).toMatch(new RegExp(`(^|[^\\d.,])${value.replace('.', '\\.')}($|[^\\d.,])`));
    }
    expect(doc.body.innerHTML).not.toMatch(/\{(pages|mb|questions|hours|min|max|count)[,}]/);
  });

  it('links to the other guest tool (RIN-1540)', async () => {
    const doc = await serverHtml();
    const link = doc.querySelector(`[data-testid="${id('cross-link')}"] a`);
    expect(link?.getAttribute('href')).toBe(c.otherTool);
    expect(link?.textContent).toBe(c.seo(c.locale).crossLink.label);
  });

  it('links to the remaining guest tool in its own sentence (RIN-1788)', async () => {
    const doc = await serverHtml();
    const link = doc.querySelector(`[data-testid="${id('cross-link-more')}"] a`);
    expect(link?.getAttribute('href')).toBe(c.moreTool);
    expect(link?.textContent).toBe(c.moreLabel(c.locale));
  });

  it('links to the photo tool, or from it to slides, in its own sentence (RIN-1795)', async () => {
    const doc = await serverHtml();
    const link = doc.querySelector(`[data-testid="${id('cross-link-extra')}"] a`);
    expect(link?.getAttribute('href')).toBe(EXTRA_TOOL[c.tool]);
    expect(link?.textContent).toBe(c.extraLabel(c.locale));
  });

  it('emits FAQPage JSON-LD equal to the visible Q&A', async () => {
    const doc = await serverHtml();
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.id).toBe(id('faq-schema'));
    const schema = JSON.parse(scripts[0]?.textContent ?? '{}');
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('FAQPage');
    const visible = Array.from(doc.querySelectorAll(`${faqSelector} li`), (item) => ({
      '@type': 'Question',
      name: item.querySelector('h3')?.textContent,
      acceptedAnswer: { '@type': 'Answer', text: item.querySelector('p')?.textContent },
    }));
    expect(visible.length).toBeGreaterThanOrEqual(4);
    expect(schema.mainEntity).toEqual(visible);
  });

  it('renders steps and FAQ in the Card surface with one body size (RIN-1508)', async () => {
    const doc = await serverHtml();
    const cards = doc.querySelectorAll(`ol > li > .card, ${faqSelector} > li > .card`);
    expect(cards).toHaveLength(3 + doc.querySelectorAll(`${faqSelector} > li`).length);
    expect(doc.body.innerHTML).not.toMatch(/bg-white|border-neutral-|text-neutral-/);
    const bodies = [
      ...Array.from(doc.querySelectorAll('ol > li p')),
      ...Array.from(doc.querySelectorAll(`${faqSelector} p`)),
      doc.querySelector(`[data-testid="${id('limits')}"]`),
      doc.querySelector(`[data-testid="${id('cross-link')}"]`),
      doc.querySelector(`[data-testid="${id('cross-link-more')}"]`),
      doc.querySelector(`[data-testid="${id('cross-link-extra')}"]`),
    ];
    for (const body of bodies) expect(body?.className).toMatch(/\btext-base\b/);
  });

  it('states the photo privacy line without a provider retention claim (RIN-1835)', async () => {
    const doc = await serverHtml();
    const text = doc.body.textContent ?? '';
    const photoLine =
      c.locale === 'vi'
        ? 'Rinkuzu không lưu ảnh của bạn. Ảnh chỉ được gửi cho nhà cung cấp nhận dạng chữ để đọc văn bản.'
        : "We don't store your photos. They go to our text-recognition provider only to read the text.";
    expect(text.includes(photoLine)).toBe(c.tool === 'photo');
    expect(text).not.toMatch(/deleted right after|xóa ngay sau/i);
  });

  it('uses the personalized wording, never adaptive', async () => {
    const doc = await serverHtml();
    expect(doc.body.textContent).not.toMatch(/adaptive|thích ứng/i);
  });
});
