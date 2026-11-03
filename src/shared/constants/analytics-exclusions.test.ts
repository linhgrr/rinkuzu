import { describe, expect, it } from 'vitest';

import {
  ANALYTICS_EXCLUDED_EMAILS,
  ANALYTICS_TEST_EMAIL_PATTERN,
} from '@/shared/constants/analytics-exclusions';

describe('analytics excluded emails', () => {
  // The repository matches the list with `$in`/`$nin`, an exact comparison
  // against the stored (lowercase) email, so a mixed-case or padded entry
  // would silently exclude nobody.
  it('holds only unique, lowercase, trimmed email addresses', () => {
    for (const email of ANALYTICS_EXCLUDED_EMAILS) {
      expect(email).toBe(email.trim().toLowerCase());
      expect(email).toMatch(/^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/);
    }
    expect(new Set(ANALYTICS_EXCLUDED_EMAILS).size).toBe(ANALYTICS_EXCLUDED_EMAILS.length);
  });

  // Reserved, non-deliverable domains are already excluded by the pattern;
  // listing one here would only hide a fixture behind a redundant entry.
  it('holds no reserved-domain addresses', () => {
    for (const email of ANALYTICS_EXCLUDED_EMAILS) {
      expect(ANALYTICS_TEST_EMAIL_PATTERN.test(email)).toBe(false);
    }
  });

  // Company-owned accounts that must never count as learners
  // (RIN-554 content, RIN-553 QA, RIN-629 ops/admin, RIN-665 W45 QA re-runs
  // and the Founder's test signup).
  it.each([
    'rinkuzu-content@fldubai.com',
    'rinkuzu-qa-w45@fldubai.com',
    'rinkuzu-ops@fldubai.com',
    'rinkuzu-qa-w45b@fldubai.com',
    'rinkuzu-qa-w45c@fldubai.com',
    'nk.toan@shirokumapower.com',
  ])('excludes the company account %s', (email) => {
    expect(ANALYTICS_EXCLUDED_EMAILS).toContain(email);
  });

  // Exact addresses only: a domain-wide exclusion would hide real learners
  // who share a company mail domain.
  it('excludes single addresses, never a whole domain', () => {
    for (const email of ANALYTICS_EXCLUDED_EMAILS) {
      expect(email.startsWith('@')).toBe(false);
    }
  });
});
