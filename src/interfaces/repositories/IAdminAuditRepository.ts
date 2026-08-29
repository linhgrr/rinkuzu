/**
 * The operator audit trail.
 *
 * A narrow port on purpose: the actions that need auditing live in several
 * unrelated services, and giving each of them a whole admin repository to reach
 * one collection is how a checkout handler ends up able to read support
 * tickets. Everything here is append-only — an audit entry that can be amended
 * is not an audit entry.
 */
export interface AdminAuditEntry {
  readonly actorId: string;
  readonly actorEmail: string;
  /** Verb-first and stable; this is what an investigator searches on. */
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  /** Flat string facts. Never the sensitive value the action revealed. */
  readonly details: Record<string, string>;
}

export interface IAdminAuditRepository {
  record(entry: AdminAuditEntry): Promise<void>;
}
