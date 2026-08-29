import { describe, expect, it } from 'vitest';
import type { SigningKey } from '../billing-config';
import { openWebhookPayload, sealWebhookPayload } from './webhook-payload-cipher';

const current: SigningKey = { kid: 'v2', secret: 'current-payload-key-with-enough-entropy-32' };
const retired: SigningKey = { kid: 'v1', secret: 'retired-payload-key-with-enough-entropy-32' };

const BODY = JSON.stringify({ data: { orderCode: 4711, reference: 'FT26' }, signature: 'abc' });

function seal(keys: readonly SigningKey[], plaintext = BODY) {
  const sealed = sealWebhookPayload(plaintext, keys);
  if (!sealed) throw new Error('Expected the payload to be sealed');
  return sealed;
}

describe('sealing', () => {
  it('round-trips a body under the newest configured key', () => {
    const sealed = seal([current, retired]);
    expect(sealed.keyVersion).toBe(current.kid);
    expect(sealed.ciphertext).not.toContain('orderCode');
    expect(openWebhookPayload(sealed, [current, retired])).toBe(BODY);
  });

  it('retains nothing when no key is configured', () => {
    // Removing the key is how an operator switches retention off. It must be a
    // decision the code honours, not an error it reports.
    expect(sealWebhookPayload(BODY, [])).toBeNull();
  });

  it('derives a distinct key per record, so one leak exposes one row', () => {
    const first = seal([current]);
    const second = seal([current]);
    expect(first.iv).not.toBe(second.iv);
    // Same plaintext, same configured secret, different ciphertext: the IV is
    // the HKDF salt, so no two rows share an encryption key.
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(openWebhookPayload(first, [current])).toBe(BODY);
    expect(openWebhookPayload(second, [current])).toBe(BODY);
  });

  it('preserves a body that is not ASCII', () => {
    const vietnamese = JSON.stringify({ desc: 'Thanh toán thành công', amount: 99_000 });
    expect(openWebhookPayload(seal([current], vietnamese), [current])).toBe(vietnamese);
  });
});

describe('opening', () => {
  it('returns null rather than throwing once the sealing key is retired', () => {
    // An operator reading old diagnostics after a rotation is an ordinary
    // situation, not an exception the admin page has to survive.
    const sealed = seal([retired]);
    expect(openWebhookPayload(sealed, [current])).toBeNull();
  });

  it('still opens rows sealed before a rotation while the old key is kept', () => {
    const sealed = seal([retired]);
    expect(openWebhookPayload(sealed, [current, retired])).toBe(BODY);
  });

  it('refuses a record whose ciphertext was altered', () => {
    const sealed = seal([current]);
    const bytes = Buffer.from(sealed.ciphertext, 'base64');
    const first = bytes[0];
    if (first === undefined) throw new Error('Expected ciphertext bytes');
    bytes[0] = first ^ 0xff;
    const tampered = { ...sealed, ciphertext: bytes.toString('base64') };
    expect(openWebhookPayload(tampered, [current])).toBeNull();
  });

  it('refuses a record whose auth tag was altered', () => {
    const sealed = seal([current]);
    const tag = Buffer.from(sealed.authTag, 'base64');
    const first = tag[0];
    if (first === undefined) throw new Error('Expected auth tag bytes');
    tag[0] = first ^ 0xff;
    expect(
      openWebhookPayload({ ...sealed, authTag: tag.toString('base64') }, [current]),
    ).toBeNull();
  });

  it('refuses a record whose IV was swapped for another row', () => {
    // The IV is also the HKDF salt, so swapping it changes the derived key.
    // Silently returning some other plaintext here would be the worst outcome.
    const first = seal([current]);
    const second = seal([current]);
    expect(openWebhookPayload({ ...first, iv: second.iv }, [current])).toBeNull();
  });

  it('refuses a record claiming a key version whose secret does not match', () => {
    const sealed = seal([retired]);
    const impostor: SigningKey = { kid: retired.kid, secret: current.secret };
    expect(openWebhookPayload(sealed, [impostor])).toBeNull();
  });

  it('refuses structurally invalid input instead of throwing', () => {
    const sealed = seal([current]);
    expect(openWebhookPayload({ ...sealed, ciphertext: 'not base64 @@@' }, [current])).toBeNull();
    expect(openWebhookPayload({ ...sealed, iv: '' }, [current])).toBeNull();
    expect(openWebhookPayload({ ...sealed, authTag: '' }, [current])).toBeNull();
  });
});
