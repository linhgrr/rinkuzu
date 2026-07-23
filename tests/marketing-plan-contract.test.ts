import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { getConstraint, getMeteredWindows } from '@/lib/entitlements';

interface LandingMessages {
  faq: Record<string, string>;
}

interface PricingMessages {
  faqs: Array<{ q: string; a: string }>;
}

function readJson<T>(path: string): T {
  return JSON.parse(fs.readFileSync(path, 'utf8')) as T;
}

function getLimit(
  tier: 'free' | 'premium',
  capability: 'ask_rin_chan' | 'quiz_extract' | 'adaptive_pipeline' | 'adaptive_generation',
  window: 'day' | 'month',
): number {
  const match = getMeteredWindows({ tier }, capability).find((entry) => entry.window === window);
  if (!match) throw new Error(`Missing ${tier} ${capability} ${window} entitlement`);
  return match.limit;
}

describe('public plan copy contract', () => {
  const enLanding = readJson<LandingMessages>('messages/en/landing.json');
  const viLanding = readJson<LandingMessages>('messages/vi/landing.json');
  const enPricing = readJson<PricingMessages>('messages/en/pricing.json');
  const viPricing = readJson<PricingMessages>('messages/vi/pricing.json');
  const llms = fs.readFileSync('src/app/llms.txt/route.ts', 'utf8');

  it('keeps the Free FAQ limits aligned with the entitlement registry in both locales', () => {
    const expectedLimits = [
      getLimit('free', 'quiz_extract', 'month'),
      getConstraint({ tier: 'free' }, 'adaptive_pdf_pages'),
      getLimit('free', 'adaptive_pipeline', 'month'),
      getLimit('free', 'adaptive_generation', 'day'),
      getLimit('free', 'ask_rin_chan', 'day'),
    ];

    for (const answer of [enLanding.faq['a3'], viLanding.faq['a3']]) {
      expect(answer).toBeDefined();
      expect(answer?.match(/\d+/g)?.map(Number)).toEqual(expectedLimits);
    }
  });

  it('describes billing as a fixed access period without automatic renewal', () => {
    expect(enPricing.faqs[1]?.a).toContain('one-time payment');
    expect(enPricing.faqs[1]?.a).toContain('does not renew automatically');
    expect(viPricing.faqs[1]?.a).toContain('thanh toán một lần');
    expect(viPricing.faqs[1]?.a).toContain('không tự động gia hạn');
  });

  it('does not advertise unsupported or unverified benefits', () => {
    const publicCopy = [
      fs.readFileSync('messages/en/landing.json', 'utf8'),
      fs.readFileSync('messages/vi/landing.json', 'utf8'),
      fs.readFileSync('messages/en/pricing.json', 'utf8'),
      fs.readFileSync('messages/vi/pricing.json', 'utf8'),
      fs.readFileSync('messages/en/premium.json', 'utf8'),
      fs.readFileSync('messages/vi/premium.json', 'utf8'),
      llms,
    ].join('\n');

    for (const unsupportedClaim of [
      /unlimited PDF/i,
      /priority support/i,
      /hỗ trợ ưu tiên/i,
      /education pricing/i,
      /giá dành cho giáo dục/i,
      /GDPR compliant/i,
      /PDPA compliant/i,
    ]) {
      expect(publicCopy).not.toMatch(unsupportedClaim);
    }
  });
});
