/** The only account fields an admin needs to pick one learner out of a search. */
export interface UserIdentity {
  id: string;
  email: string;
  displayName?: string;
}

/**
 * Read-only identity resolution for admin tools. Kept apart from
 * `IUserRepository` so it can never hand back more than `UserIdentity`.
 */
export interface IUserIdentityRepository {
  /**
   * Admin-inclusive (disabled accounts too) case-insensitive substring match
   * on name, display name or email, capped at `limit` accounts.
   */
  findByNameOrEmail(search: string, limit: number): Promise<UserIdentity[]>;
}
