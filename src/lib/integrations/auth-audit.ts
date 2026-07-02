import type { IAuthAudit, AuthAuditRecord } from '@/interfaces/services/IAuthAudit';
import { recordAuthEvent } from '@/lib/audit';

export class AuthAuditAdapter implements IAuthAudit {
  async record(input: AuthAuditRecord): Promise<void> {
    await recordAuthEvent(input);
  }
}
