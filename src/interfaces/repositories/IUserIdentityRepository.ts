/** Minimal admin-inclusive identity, for labelling rows keyed only by user id. */
export interface UserIdentity {
  id: string;
  email: string;
  displayName?: string;
}

/**
 * Read-only account labelling for admin analytics. Kept apart from
 * `IUserRepository` because the rows it labels come from another service and
 * carry no account state of their own — a disabled or deleted account is a
 * legitimate, unremarkable result here.
 */
export interface IUserIdentityRepository {
  /**
   * Admin-inclusive bulk lookup. Unknown or deleted ids are simply absent from
   * the result; callers fall back to the raw id.
   */
  findIdentitiesByIds(ids: readonly string[]): Promise<UserIdentity[]>;
  /** Admin-inclusive id lookup by name / displayName / email substring. */
  findIdsByNameOrEmail(search: string, limit: number): Promise<string[]>;
}
