import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import { AdminActionAudit } from '@/models/Communication';
import type {
  AdminAuditEntry,
  IAdminAuditRepository,
} from '@/interfaces/repositories/IAdminAuditRepository';

/**
 * How long an operator action stays on the record. Long enough to outlive a
 * dispute, bounded so the collection cannot grow without end; the TTL index on
 * `expiresAt` does the collecting.
 */
const AUDIT_RETENTION_MS = 5 * 365 * 86_400_000;

export class AdminAuditRepository implements IAdminAuditRepository {
  async record(entry: AdminAuditEntry): Promise<void> {
    await connectDB();
    await AdminActionAudit.create({
      actorId: new Types.ObjectId(entry.actorId),
      actorEmail: entry.actorEmail,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details,
      expiresAt: new Date(Date.now() + AUDIT_RETENTION_MS),
    });
  }
}
