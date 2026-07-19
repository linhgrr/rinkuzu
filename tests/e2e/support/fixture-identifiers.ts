import { createHash } from 'node:crypto';

const E2E_EMAIL_DOMAIN = 'example.com';
const E2E_EMAIL_ID_LENGTH = 24;

export type E2EUserKind = 'admin' | 'regular' | 'target';

export function createE2EUserEmail(kind: E2EUserKind, runId: string): string {
  const emailId = createHash('sha256').update(runId).digest('hex').slice(0, E2E_EMAIL_ID_LENGTH);
  return `e2e-${kind}-${emailId}@${E2E_EMAIL_DOMAIN}`;
}
