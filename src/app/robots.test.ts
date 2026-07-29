import { describe, expect, it } from 'vitest';
import robots from './robots';

describe('robots', () => {
  it('allows auth pages to be crawled so their noindex metadata can be read', () => {
    const rules = robots().rules;
    const defaultRule = (Array.isArray(rules) ? rules : [rules]).find(
      (rule) => rule.userAgent === '*',
    );
    const disallow = Array.isArray(defaultRule?.disallow)
      ? defaultRule.disallow
      : [defaultRule?.disallow].filter(Boolean);

    expect(disallow).not.toContain('/vi/login');
    expect(disallow).not.toContain('/en/register');
    expect(disallow).toContain('/vi/dashboard');
    expect(disallow).toContain('/en/dashboard');
  });
});
