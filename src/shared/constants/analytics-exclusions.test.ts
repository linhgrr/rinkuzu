import { describe, expect, it } from 'vitest';

import { ANALYTICS_EXCLUDED_EMAILS } from '@/shared/constants/analytics-exclusions';

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
});
