import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readAndValidateJson, readJsonBody } from '@/lib/api/request';

describe('readJsonBody', () => {
  it('returns parsed JSON without prescribing a DTO', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ name: 'Rin' }),
    });

    await expect(readJsonBody(request)).resolves.toEqual({
      success: true,
      data: { name: 'Rin' },
    });
  });

  it('returns a stable validation error for malformed JSON', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      body: '{',
    });

    await expect(readJsonBody(request)).resolves.toEqual({
      success: false,
      error: 'Request body must be valid JSON',
    });
  });

  it('validates parsed JSON and returns field errors', async () => {
    const validRequest = new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ name: 'Rin' }),
    });
    const invalidRequest = new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    });
    const schema = z.object({ name: z.string().min(1, 'Name is required') });

    await expect(readAndValidateJson(validRequest, schema)).resolves.toEqual({
      success: true,
      data: { name: 'Rin' },
    });
    await expect(readAndValidateJson(invalidRequest, schema)).resolves.toEqual({
      success: false,
      error: 'Name is required',
      fields: { name: 'Name is required' },
    });
  });

  it('returns a required empty field-error map for malformed JSON validation requests', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      body: '{',
    });
    const schema = z.object({ name: z.string().min(1, 'Name is required') });

    await expect(readAndValidateJson(request, schema)).resolves.toEqual({
      success: false,
      error: 'Request body must be valid JSON',
      fields: {},
    });
  });
});
