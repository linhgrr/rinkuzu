/**
 * Server-side ownership and structural validation for adaptive pipeline S3 keys.
 *
 * Presigned uploads mint keys as:
 *   uploads/adaptive_pipeline/{userId}/{timestamp}-{safeName}
 *
 * Never trust a client-supplied key as proof of ownership. Always re-derive the
 * expected namespace from the authenticated userId and fail closed.
 */

const ADAPTIVE_PIPELINE_UPLOAD_PREFIX = 'uploads/adaptive_pipeline';

const MAX_S3_KEY_LENGTH = 1024;

export type OwnedAdaptivePipelineS3KeyResult =
  | { ok: true; key: string }
  | { ok: false; error: string };

function buildAdaptivePipelineObjectKeyPrefix(userId: string): string {
  return `${ADAPTIVE_PIPELINE_UPLOAD_PREFIX}/${userId}/`;
}

function isUnsafeUserId(userId: string): boolean {
  return (
    userId.length === 0 ||
    userId !== userId.trim() ||
    userId.includes('/') ||
    userId.includes('\\') ||
    userId.includes('\0') ||
    userId.includes('%') ||
    userId.includes('..')
  );
}

function hasUnsafePathShape(key: string): boolean {
  if (key.length === 0 || key.length > MAX_S3_KEY_LENGTH) return true;
  if (key !== key.trim()) return true;
  if (key.includes('\\') || key.includes('\0')) return true;
  if (key.startsWith('/') || /^[A-Za-z]:/.test(key)) return true;
  if (key.includes('://')) return true;

  const segments = key.split('/');
  // Reject empty segments ("//"), "." / ".." traversal, and trailing slash.
  if (segments.length < 2) return true;
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') return true;
  }
  return false;
}

function tryDecodeOnce(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function hasUnsafeRelativeRemainder(remainder: string): boolean {
  if (remainder.length === 0) return true;
  if (remainder.includes('\\') || remainder.includes('\0')) return true;
  if (remainder.startsWith('/') || /^[A-Za-z]:/.test(remainder)) return true;
  return remainder
    .split('/')
    .some((segment) => segment.length === 0 || segment === '.' || segment === '..');
}

/**
 * Fail-closed ownership check for adaptive pipeline object keys.
 * Returns the original key only when it is structurally safe and lives under
 * the authenticated user's server-derived namespace.
 */
export function resolveOwnedAdaptivePipelineS3Key(
  rawKey: string,
  userId: string,
): OwnedAdaptivePipelineS3KeyResult {
  if (typeof rawKey !== 'string' || typeof userId !== 'string' || isUnsafeUserId(userId)) {
    return { ok: false, error: 'Invalid s3Key' };
  }

  if (hasUnsafePathShape(rawKey)) {
    return { ok: false, error: 'Invalid s3Key' };
  }

  // Decoding boundary: reject encoded traversal / separator smuggling.
  const decoded = tryDecodeOnce(rawKey);
  if (decoded === null || hasUnsafePathShape(decoded)) {
    return { ok: false, error: 'Invalid s3Key' };
  }

  // A second decode catches double-encoded traversal if the first decode changed
  // the string (e.g. %252e%252e → %2e%2e).
  if (decoded !== rawKey) {
    const decodedTwice = tryDecodeOnce(decoded);
    if (decodedTwice === null || hasUnsafePathShape(decodedTwice)) {
      return { ok: false, error: 'Invalid s3Key' };
    }
  }

  const expectedPrefix = buildAdaptivePipelineObjectKeyPrefix(userId);
  if (!rawKey.startsWith(expectedPrefix) || !decoded.startsWith(expectedPrefix)) {
    return { ok: false, error: 's3Key is outside the authenticated user namespace' };
  }

  const remainder = rawKey.slice(expectedPrefix.length);
  if (hasUnsafeRelativeRemainder(remainder)) {
    return { ok: false, error: 'Invalid s3Key' };
  }

  // Never rewrite the key — only accept keys that already live in the owned namespace.
  return { ok: true, key: rawKey };
}
