const EMAIL_MAX_LENGTH = 254;

/**
 * Canonical storage and lookup representation for email addresses.
 * Provider-specific dot and plus-tag rules are deliberately excluded.
 */
export function canonicalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export { EMAIL_MAX_LENGTH };
