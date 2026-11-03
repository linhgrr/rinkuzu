/**
 * The admin-set `isTestAccount` flag, kept off `IUserRepository` so only the
 * test-account service can write it.
 */
export interface IUserTestAccountRepository {
  /**
   * Sets the flag and returns the value it had before (absent reads as
   * `false`), or `null` when no user has that id.
   */
  setTestAccount(userId: string, isTestAccount: boolean): Promise<{ previous: boolean } | null>;
  /**
   * Puts the flag back to `previous`, only if it still holds `current`, so a
   * concurrent admin change is never overwritten.
   */
  revertTestAccount(userId: string, current: boolean, previous: boolean): Promise<void>;
}
