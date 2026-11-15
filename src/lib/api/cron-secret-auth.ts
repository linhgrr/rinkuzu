import { timingSafeEqual } from 'node:crypto';

/**
 * Whether the request carries `Authorization: Bearer <CRON_SECRET>`: the check
 * shared by the internal routes a scheduler or an operator calls with `curl`
 * (communications worker, outage notify send). Fails closed when the secret is
 * unset, and compares in constant time.
 */
export function hasCronSecretBearer(request: Request): boolean {
  const expected = process.env['CRON_SECRET']?.trim() ?? '';
  if (!expected) return false;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/iu, '') ?? '';
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
  );
}
