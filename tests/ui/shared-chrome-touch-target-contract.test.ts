import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Touch targets in shared chrome (RIN-1554, audit RIN-1553): every link, button,
 * chip and icon button is at least 44 x 44 px (`min-h-11` / `size-11`), and
 * stacked or adjacent targets keep 8 px between them (`gap-2` / `space-y-2`).
 */
const read = (file: string) => fs.readFileSync(file, 'utf8');

const appChrome = read('src/components/app-chrome/AppChrome.tsx');
const sectionHeading = read('src/components/ui/SectionHeading.tsx');
const explore = read('src/features/explore/components/ExplorePageClient.tsx');
const topicHub = read('src/app/[locale]/(app)/explore/[topic]/page.tsx');
const footer = read('src/features/landing/components/new-landing/Footer.tsx');
const faq = read('src/app/[locale]/(marketing)/faq/page.tsx');
const shareButtons = read('src/components/blog/ShareButtons.tsx');
const toc = read('src/components/blog/TableOfContents.tsx');
const consent = read('src/components/analytics/AnalyticsRoot.tsx');
const blogPost = read('src/app/[locale]/(marketing)/blog/[slug]/page.tsx');

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start, `${name} exists`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe('shared chrome touch targets', () => {
  it('sidebar sub-items are 44 px rows, 8 px apart, and the active bar follows that pitch', () => {
    const subItem = functionBody(appChrome, 'SidebarSubItem');
    expect(subItem).toMatch(/className=\{`relative flex h-11 items-center/);
    expect(subItem).not.toContain('h-10');
    expect(appChrome).toMatch(/const SUB_ITEM_HEIGHT_PX = 44;/);
    expect(appChrome).toMatch(/const SUB_ITEM_GAP_PX = 8;/);
    const navSection = functionBody(appChrome, 'NavSection');
    expect(navSection).toMatch(/relative flex flex-col gap-2 overflow-hidden pt-3/);
    expect(navSection).toMatch(/absolute left-6 top-3 h-11 w-0\.5/);
    expect(navSection).toContain('activeIndex * (SUB_ITEM_HEIGHT_PX + SUB_ITEM_GAP_PX)');
  });

  it('topbar logo links and the collapse-sidebar button are at least 44 px', () => {
    const topbar = functionBody(appChrome, 'AppTopbar');
    expect(topbar).not.toMatch(/\bh-10\b|\bsize-10\b|size-\[44px\]/);
    expect(topbar).toContain('flex size-11 items-center justify-center rounded-control');
  });

  it('the section "view all" link has a 44 px hit area', () => {
    expect(sectionHeading).toMatch(/className="inline-flex min-h-11 shrink-0 items-center gap-2/);
  });

  it('explore filter pills are 44 px and the mobile search keeps 16 px from the topic chips', () => {
    expect(explore).toMatch(/min-h-11 shrink-0 rounded-full px-4/);
    expect(explore).not.toContain('min-h-10');
    expect(explore).toContain('<div className="mt-4 lg:hidden">');
  });

  it('topic hub breadcrumb and "see more" links have 44 px hit areas', () => {
    expect(topicHub).not.toContain('className="hover:text-accent"');
    expect(topicHub.match(/inline-flex min-h-11 items-center hover:text-accent/g)).toHaveLength(2);
    expect(topicHub).toContain('className="inline-flex min-h-11 items-center text-sm text-accent"');
  });

  it('footer links are 44 px rows with 8 px between them', () => {
    expect(
      footer.match(/className="inline-flex min-h-11 min-w-11 items-center rounded-sm/g),
    ).toHaveLength(2);
    expect(footer).not.toContain('space-y-3.5');
    expect(footer.match(/<ul className="space-y-2">/g)).toHaveLength(2);
  });

  it('FAQ category chips are 44 px tall', () => {
    expect(faq).toMatch(/inline-flex min-h-11 items-center rounded-full bg-neutral-100 px-4/);
  });

  it('blog share buttons, breadcrumb links and TOC entries are at least 44 px', () => {
    expect(shareButtons).not.toMatch(/\bh-9\b|\bw-9\b|\bsize-9\b/);
    expect(shareButtons.match(/size-11 rounded-full/g)).toHaveLength(2);
    expect(
      blogPost.match(
        /inline-flex min-h-11 min-w-11 items-center justify-center hover:text-\[var\(--text-primary\)\]/g,
      ),
    ).toHaveLength(2);
    expect(toc).toMatch(/flex min-h-11 w-full items-center border-l-2 pl-4 py-2 text-left text-sm/);
    expect(toc).toContain('<ul className="space-y-2">');
  });

  it('the explore sign-in prompt, FAQ cross-links, footer form and consent banner keep targets and a 16 px text-to-control gap', () => {
    expect(explore).toContain('flex flex-col items-start gap-4 sm:flex-row');
    expect(
      faq.match(/inline-flex min-h-11 items-center font-medium text-brand-trust/g),
    ).toHaveLength(2);
    expect(footer).not.toMatch(/className="h-10 (flex-1|whitespace-nowrap)/);
    expect(consent).toContain('mt-4 flex shrink-0 items-center justify-between gap-2 sm:mt-0');
    expect(consent).not.toContain('min-h-6');
  });
});
