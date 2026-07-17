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
interface ServiceSuccess<T> {
  success: true;
  data: T;
}

export interface ServiceFailure {
  success: false;
  error: string;
  statusCode: number;
  // Stable, i18n-independent error code. Clients branch on this instead of
  // matching the human-readable `error` string.
  code?: string;
}

export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;
