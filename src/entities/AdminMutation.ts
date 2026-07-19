import type { AccountDisableState } from '@/shared/constants/account-disable';
import type { User } from '@/entities/User';

export type AdminMutationActor = {
  id: string;
  email: string;
};

export type AdminRoleMutationInput = {
  kind: 'role';
  targetUserId: string;
  role: User['role'];
  actor: AdminMutationActor;
};

export type AdminDisableMutationInput = {
  kind: 'disable';
  targetUserId: string;
  disable: AccountDisableState;
  actor: AdminMutationActor;
  now: Date;
};

/** Discriminated admin role/status mutation executed inside one transaction. */
export type AdminMutationInput = AdminRoleMutationInput | AdminDisableMutationInput;

export type AdminRoleMutationResult = {
  kind: 'role';
  user: User;
  changed: boolean;
  role: User['role'];
};

export type AdminDisableMutationResult = {
  kind: 'disable';
  user: User;
  changed: boolean;
  disable: AccountDisableState;
};

export type AdminMutationResult = AdminRoleMutationResult | AdminDisableMutationResult;

/** Reducing the active-admin set would leave zero active admins. Maps to 409. */
export class LastActiveAdminError extends Error {
  readonly code = 'last_active_admin' as const;

  constructor(message = 'Cannot remove or disable the last active admin') {
    super(message);
    this.name = 'LastActiveAdminError';
  }
}

/**
 * Fence missing/malformed, touch failed, transactions unavailable/unsupported,
 * or unexpected DB transaction failure. Maps to 503.
 */
export class AdminInvariantUnavailableError extends Error {
  readonly code = 'admin_invariant_unavailable' as const;

  constructor(cause?: unknown) {
    super('Active-admin invariant is unavailable', cause === undefined ? undefined : { cause });
    this.name = 'AdminInvariantUnavailableError';
  }
}

/** Actor no longer matches id+email+role admin+disable 0 inside the transaction. Maps to 403. */
export class ActorNotActiveAdminError extends Error {
  constructor(message = 'Actor is not an active admin') {
    super(message);
    this.name = 'ActorNotActiveAdminError';
  }
}

/** Target user missing inside the transaction. Maps to 404. */
export class AdminMutationTargetNotFoundError extends Error {
  constructor(message = 'User not found') {
    super(message);
    this.name = 'AdminMutationTargetNotFoundError';
  }
}

/**
 * Concurrent mutation conflict observed inside the transaction (conditional
 * write missed while state is not already at the requested target). Maps to 409.
 */
export class AdminMutationConflictError extends Error {
  constructor(message = 'Admin mutation state conflict') {
    super(message);
    this.name = 'AdminMutationConflictError';
  }
}
