import { describe, expect, it } from 'vitest';
import { isAllowedByRule, robotsRuleFor } from '../../tests/helpers/robots-match';
import robots from './robots';

const NAMED_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-WebBot',
  'Google-Extended',
  'OAI-SearchBot',
  'PerplexityBot',
  'Diffbot',
  'Bytespider',
  'Applebot-Extended',
];

// Pages we want indexed (RIN-1246) stay crawlable for every group.
const ALLOWED = [
  '/vi',
  '/vi/quiz/on-tap-sinh-hoc-000001',
  '/en/quiz/intro-to-ai-000002',
  '/vi/blog',
  '/vi/blog/cach-on-thi-hieu-qua',
  '/en/blog/play-smarter-study-less',
  '/vi/try/pdf',
  '/en/try/text',
  '/en/try/slides',
  '/en/try/photo',
  '/vi/explore',
  '/vi/explore/sinh-hoc',
  '/vi/premium-quizzes',
  '/vi/login',
  '/en/register',
];

// Pages with nothing to index, private pages and the API (RIN-1644 AC 6).
const DISALLOWED = [
  '/api/quizzes?page=1',
  '/api/premium-quizzes',
  '/vi/admin',
  '/en/admin/users',
  '/vi/dashboard',
  '/en/dashboard',
  '/vi/try/pdf/play',
  '/en/try/text/play',
  '/vi/try/photo/play',
  '/vi/quiz/on-tap-sinh-hoc-000001/flashcards',
  '/vi/quiz/on-tap-sinh-hoc-000001/result',
  '/vi/explore?q=sinh',
  '/en/explore?type=quizzes&page=2',
];

describe('robots', () => {
  it.each(['*', ...NAMED_CRAWLERS])('%s may crawl the pages we want indexed', (userAgent) => {
    const rule = robotsRuleFor(robots(), userAgent);
    for (const path of ALLOWED) expect(isAllowedByRule(rule, path), path).toBe(true);
  });

  it.each(['*', ...NAMED_CRAWLERS])(
    '%s may not crawl the API, private pages or pages with nothing to index',
    (userAgent) => {
      const rule = robotsRuleFor(robots(), userAgent);
      for (const path of DISALLOWED) expect(isAllowedByRule(rule, path), path).toBe(false);
    },
  );

  it('gives every named crawler the same disallow list as *', () => {
    const defaultRule = robotsRuleFor(robots(), '*');
    expect(defaultRule.disallow).toEqual(expect.arrayContaining(['/api/', '/vi/explore?']));
    for (const userAgent of NAMED_CRAWLERS) {
      const rule = robotsRuleFor(robots(), userAgent);
      expect(rule.allow).toBe('/');
      expect(rule.disallow).toEqual(defaultRule.disallow);
    }
  });

  it('allows auth pages to be crawled so their noindex metadata can be read', () => {
    const disallow = robotsRuleFor(robots(), '*').disallow;

    expect(disallow).not.toContain('/vi/login');
    expect(disallow).not.toContain('/en/register');
    expect(disallow).toContain('/vi/dashboard');
    expect(disallow).toContain('/en/dashboard');
  });
});
