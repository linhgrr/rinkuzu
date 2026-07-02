import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  readAndValidateJson,
  readAndValidateRouteParams,
  readAndValidateSearchParams,
  readJsonBody,
} from '@/lib/api/request';

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

  it('validates URL search parameters through the same field-error contract', () => {
    const schema = z.object({
      page: z.coerce.number().int().min(1, 'Page must be positive'),
      search: z.string().optional(),
    });

    expect(
      readAndValidateSearchParams(
        new Request('http://localhost/api?page=2&search=algebra'),
        schema,
      ),
    ).toEqual({
      success: true,
      data: { page: 2, search: 'algebra' },
    });
    expect(readAndValidateSearchParams(new Request('http://localhost/api?page=0'), schema)).toEqual(
      {
        success: false,
        error: 'Page must be positive',
        fields: { page: 'Page must be positive' },
      },
    );
  });

  it('validates dynamic route params without accepting array fallbacks', () => {
    const schema = z.object({ id: z.string().uuid('Invalid id') });

    expect(
      readAndValidateRouteParams({ id: '6c8de438-4b58-42bb-8131-769c7c803d6f' }, schema),
    ).toEqual({
      success: true,
      data: { id: '6c8de438-4b58-42bb-8131-769c7c803d6f' },
    });

    expect(
      readAndValidateRouteParams({ id: ['6c8de438-4b58-42bb-8131-769c7c803d6f'] }, schema),
    ).toEqual({
      success: false,
      error: 'Invalid input: expected string, received array',
      fields: { id: 'Invalid input: expected string, received array' },
    });
  });
});
