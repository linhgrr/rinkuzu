export interface MongoServerErrorLike {
  code?: unknown;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
}

export function isMongoDuplicateKeyError(error: unknown): error is MongoServerErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as MongoServerErrorLike).code === 11000
  );
}

export function isMongoDuplicateKeyErrorForField(error: unknown, field: string): boolean {
  if (!isMongoDuplicateKeyError(error)) return false;
  return Boolean(error.keyPattern?.[field] || error.keyValue?.[field]);
}
