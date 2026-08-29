import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseJsonBody, parseParamsAndBody, parseRouteParams } from '@/lib/api/validated';

const idSchema = z.strictObject({ id: z.string().min(1) });
const bodySchema = z.strictObject({ revision: z.number().int().min(0) });

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('parseRouteParams', () => {
  it('returns data on success', () => {
    const result = parseRouteParams({ id: 'abc' }, idSchema);
    expect(result).toEqual({ ok: true, data: { id: 'abc' } });
  });

  it('returns a 400 validation_error envelope on failure', async () => {
    const result = parseRouteParams({}, idSchema);
    if (result.ok) throw new Error('expected failure');
    expect(result.response.status).toBe(400);
    const payload = await result.response.json();
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('validation_error');
  });
});

describe('parseJsonBody', () => {
  it('returns parsed body on success', async () => {
    const result = await parseJsonBody(jsonRequest({ revision: 2 }), bodySchema);
    expect(result).toEqual({ ok: true, data: { revision: 2 } });
  });

  it('rejects invalid JSON with 400', async () => {
    const request = new NextRequest('http://localhost/api/test', { method: 'POST', body: '{nope' });
    const result = await parseJsonBody(request, bodySchema);
    if (result.ok) throw new Error('expected failure');
    expect(result.response.status).toBe(400);
  });
});

describe('parseParamsAndBody', () => {
  it('validates params before body and returns both', async () => {
    const result = await parseParamsAndBody(
      jsonRequest({ revision: 1 }),
      { id: 'x' },
      {
        params: idSchema,
        body: bodySchema,
      },
    );
    if (!result.ok) throw new Error('expected success');
    expect(result.params).toEqual({ id: 'x' });
    expect(result.body).toEqual({ revision: 1 });
  });

  it('fails on bad params without reading the body', async () => {
    const result = await parseParamsAndBody(
      jsonRequest({ revision: 1 }),
      {},
      {
        params: idSchema,
        body: bodySchema,
      },
    );
    expect(result.ok).toBe(false);
  });
});
