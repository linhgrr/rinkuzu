/**
 * Discriminated union for service-layer responses.
 *
 * Use the `success` field as the discriminant — TypeScript narrows
 * automatically:
 *
 *   const result = await service.foo();
 *   if (result.success) {
 *     result.data; // T
 *   } else {
 *     result.error; // string
 *     result.statusCode; // number
 *   }
 */
export interface ServiceSuccess<T> {
  success: true;
  data: T;
}

export interface ServiceFailure {
  success: false;
  error: string;
  statusCode: number;
}

export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

/**
 * Test helper: assert success and narrow. Throws if the result is a failure.
 * Allows callers to access `result.data` safely after the call.
 */
export function assertOk<T>(result: ServiceResult<T>): asserts result is ServiceSuccess<T> {
  if (!result.success) {
    throw new Error(`Expected ServiceResult.success=true, got error="${result.error}"`);
  }
}

/**
 * Test helper: assert failure and narrow.
 */
export function assertFail<T>(result: ServiceResult<T>): asserts result is ServiceFailure {
  if (result.success) {
    throw new Error(
      `Expected ServiceResult.success=false, got data=${JSON.stringify(result.data)}`,
    );
  }
}
