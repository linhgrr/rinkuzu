/**
 * Accounts that never count as learners in ground-truth analytics
 * (`/api/admin/stats/activation`).
 *
 * Besides `role = admin` and disabled accounts, an account is a test account
 * when its email is on a reserved, non-deliverable domain (RFC 2606 / RFC 6761:
 * `example.com|net|org` and the `.test`, `.example`, `.invalid`, `.localhost`
 * TLDs). Nobody can sign up on those and receive mail, so every such account
 * was made by a test, a fixture or QA.
 *
 * Known QA accounts on real domains go in `ANALYTICS_EXCLUDED_EMAILS`
 * (lowercase). Keep that list to accounts the company owns; it is a constant
 * in Git, so it must never hold a real learner's address.
 */
/**
 * Company accounts whose public quizzes are the public catalog (the starter
 * quizzes, RIN-554). They never count as learners, but their quizzes stay in
 * the sitemap and indexable (RIN-840): this set wins over every other rule in
 * `isNonIndexableQuizOwner`.
 */
export const PUBLIC_CATALOG_OWNER_EMAILS: readonly string[] = [
  // Content account that owns the public starter quizzes (RIN-554).
  'rinkuzu-content@fldubai.com',
];

/**
 * Mail domain the company uses for its own QA, ops and content accounts. Only
 * quiz indexing uses it (RIN-840); learner analytics keep to exact addresses.
 */
const COMPANY_TEST_EMAIL_DOMAIN = 'fldubai.com';

export const ANALYTICS_EXCLUDED_EMAILS: readonly string[] = [
  ...PUBLIC_CATALOG_OWNER_EMAILS,
  // QA account for the W45-P1 production walk (RIN-553).
  'rinkuzu-qa-w45@fldubai.com',
  // Company ops/admin account created by SRE (RIN-629).
  'rinkuzu-ops@fldubai.com',
  // QA W45 re-run account (RIN-665).
  'rinkuzu-qa-w45b@fldubai.com',
  // QA W45 re-run account (RIN-665).
  'rinkuzu-qa-w45c@fldubai.com',
  // Founder starter-quiz test signup (RIN-665). This one address only, not its domain.
  'nk.toan@shirokumapower.com',
];

export const ANALYTICS_TEST_EMAIL_PATTERN =
  /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|net|org)|[a-z0-9-]+\.(?:test|example|invalid|localhost))$/i;

/** Case-insensitive `@<COMPANY_TEST_EMAIL_DOMAIN>` suffix, for Mongo queries. */
export const COMPANY_TEST_EMAIL_PATTERN = new RegExp(
  `@${COMPANY_TEST_EMAIL_DOMAIN.replace(/\./g, '\\.')}$`,
  'i',
);

export interface QuizOwnerIndexingFields {
  email?: string | null;
  isTestAccount?: boolean | null;
}

/**
 * True when public quizzes owned by this account must stay out of the sitemap
 * and carry `noindex` (RIN-840): an admin-flagged test account, a reserved
 * test domain, a listed company account or any company-domain address. The
 * public catalog owners always stay indexable. Never exclude by role: the
 * Founder may own real public quizzes. Server-only: it reads the email.
 */
export function isNonIndexableQuizOwner(owner: QuizOwnerIndexingFields): boolean {
  const email = owner.email?.trim().toLowerCase() ?? '';
  if (email && PUBLIC_CATALOG_OWNER_EMAILS.includes(email)) return false;
  if (owner.isTestAccount === true) return true;
  if (!email) return false;
  return (
    ANALYTICS_TEST_EMAIL_PATTERN.test(email) ||
    ANALYTICS_EXCLUDED_EMAILS.includes(email) ||
    COMPANY_TEST_EMAIL_PATTERN.test(email)
  );
}
