import { describe, expect, it } from 'vitest';

import {
  ANALYTICS_EXCLUDED_EMAILS,
  ANALYTICS_TEST_EMAIL_PATTERN,
  COMPANY_TEST_EMAIL_PATTERN,
  PUBLIC_CATALOG_OWNER_EMAILS,
  isNonIndexableQuizOwner,
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

describe('isNonIndexableQuizOwner (RIN-840)', () => {
  const catalogOwner = PUBLIC_CATALOG_OWNER_EMAILS[0] ?? '';
  const listedTestAccount =
    ANALYTICS_EXCLUDED_EMAILS.find((email) => !PUBLIC_CATALOG_OWNER_EMAILS.includes(email)) ?? '';

  it('keeps the catalog owner in the learner exclusions, written once', () => {
    expect(catalogOwner).not.toBe('');
    expect(ANALYTICS_EXCLUDED_EMAILS).toEqual(
      expect.arrayContaining([...PUBLIC_CATALOG_OWNER_EMAILS]),
    );
    expect(COMPANY_TEST_EMAIL_PATTERN.test(catalogOwner)).toBe(true);
  });

  it('excludes an admin-flagged test account on a learner domain', () => {
    expect(isNonIndexableQuizOwner({ email: 'learner@gmail.com', isTestAccount: true })).toBe(true);
    expect(isNonIndexableQuizOwner({ isTestAccount: true })).toBe(true);
  });

  it.each(['fixture@example.com', 'qa@sub.example.org', 'seed@school.test', 'X@Demo.Invalid'])(
    'excludes the reserved test domain address %s',
    (email) => {
      expect(isNonIndexableQuizOwner({ email })).toBe(true);
    },
  );

  it('excludes a listed company account, in any case', () => {
    expect(listedTestAccount).not.toBe('');
    expect(isNonIndexableQuizOwner({ email: listedTestAccount })).toBe(true);
    expect(isNonIndexableQuizOwner({ email: ` ${listedTestAccount.toUpperCase()} ` })).toBe(true);
  });

  it.each(['qa-new-run@fldubai.com', 'Someone@FLDUBAI.COM'])(
    'excludes any company-domain address such as %s',
    (email) => {
      expect(isNonIndexableQuizOwner({ email })).toBe(true);
    },
  );

  it('does not treat a look-alike domain as the company domain', () => {
    expect(COMPANY_TEST_EMAIL_PATTERN.test('learner@notfldubai.com')).toBe(false);
    expect(COMPANY_TEST_EMAIL_PATTERN.test('learner@fldubaixcom')).toBe(false);
    expect(isNonIndexableQuizOwner({ email: 'learner@fldubai.com.vn' })).toBe(false);
  });

  it('keeps the public catalog owner indexable, in any case and even when flagged', () => {
    expect(isNonIndexableQuizOwner({ email: catalogOwner })).toBe(false);
    expect(isNonIndexableQuizOwner({ email: catalogOwner.toUpperCase() })).toBe(false);
    expect(isNonIndexableQuizOwner({ email: catalogOwner, isTestAccount: true })).toBe(false);
  });

  it('keeps a normal learner and an owner without an email indexable', () => {
    expect(isNonIndexableQuizOwner({ email: 'learner@gmail.com', isTestAccount: false })).toBe(
      false,
    );
    expect(isNonIndexableQuizOwner({ email: null })).toBe(false);
    expect(isNonIndexableQuizOwner({})).toBe(false);
  });
});
