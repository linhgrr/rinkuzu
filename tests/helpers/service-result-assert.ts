import type { ServiceResult } from '@/interfaces/services/types';

type ServiceSuccessOf<T> = Extract<ServiceResult<T>, { success: true }>;
type ServiceFailureOf<T> = Extract<ServiceResult<T>, { success: false }>;

/**
 * Test helper: assert success and narrow. Throws if the result is a failure.
 * Allows callers to access `result.data` safely after the call.
 */
export function assertOk<T>(result: ServiceResult<T>): asserts result is ServiceSuccessOf<T> {
  if (!result.success) {
    throw new Error(`Expected ServiceResult.success=true, got error="${result.error}"`);
  }
}

/**
 * Test helper: assert failure and narrow.
 */
export function assertFail<T>(result: ServiceResult<T>): asserts result is ServiceFailureOf<T> {
  if (result.success) {
    throw new Error(
      `Expected ServiceResult.success=false, got data=${JSON.stringify(result.data)}`,
    );
  }
}
