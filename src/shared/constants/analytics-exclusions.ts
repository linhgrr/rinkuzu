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
export const ANALYTICS_EXCLUDED_EMAILS: readonly string[] = [
  // Content account that owns the public starter quizzes (RIN-554).
  'rinkuzu-content@fldubai.com',
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
