import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchApiDataMock } = vi.hoisted(() => ({
  fetchApiDataMock: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  fetchApiData: fetchApiDataMock,
}));

import {
  createAdminOcrKey,
  deleteAdminOcrKey,
  fetchAdminOcrKeysViewModel,
  testAdminOcrKey,
  updateAdminOcrKey,
} from '@/features/admin/ocr-keys/api/admin-ocr-keys-api';

const keyDto = {
  key_id: 'key-1',
  provider: 'landingai',
  label: 'Primary',
  masked_key: 'land••••••••1234',
  enabled: true,
  health_status: 'healthy' as const,
  priority: 10,
  success_count: 4,
  failure_count: 1,
  last_used_at: null,
  last_success_at: null,
  last_error_at: null,
  last_error_code: null,
  last_error_message: null,
  created_at: '2026-07-10T00:00:00Z',
  updated_at: '2026-07-10T00:00:00Z',
};

describe('admin-ocr-keys-api', () => {
  afterEach(() => {
    fetchApiDataMock.mockReset();
  });

  it('fetches OCR keys and maps aggregate view-model counts', async () => {
    const signal = new AbortController().signal;
    fetchApiDataMock.mockResolvedValue({
      fallback_env_configured: true,
      keys: [keyDto, { ...keyDto, key_id: 'key-2', enabled: false, health_status: 'failed' }],
    });

    await expect(fetchAdminOcrKeysViewModel(signal)).resolves.toMatchObject({
      fallbackEnvConfigured: true,
      activeKeyCount: 1,
      failedKeyCount: 1,
      keys: [{ id: 'key-1' }, { id: 'key-2' }],
    });
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/ocr-keys', { signal });
  });

  it('creates and patches with snake_case transport payloads', async () => {
    fetchApiDataMock.mockResolvedValue({ key: keyDto });

    await expect(
      createAdminOcrKey({ label: 'Primary', apiKey: 'secret', priority: 3 }),
    ).resolves.toMatchObject({ id: 'key-1', maskedKey: 'land••••••••1234' });
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/ocr-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: 'Primary',
        api_key: 'secret',
        priority: 3,
      }),
    });

    await updateAdminOcrKey('key/1', {
      label: 'Updated',
      apiKey: 'new-secret',
      priority: 1,
      enabled: false,
    });
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/admin/ocr-keys/key%2F1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: 'Updated',
        api_key: 'new-secret',
        priority: 1,
        enabled: false,
      }),
    });

    await updateAdminOcrKey('key-1', { enabled: true });
    expect(JSON.parse(fetchApiDataMock.mock.calls.at(-1)?.[1].body as string)).toEqual({
      enabled: true,
    });
  });

  it('tests and deletes keys with encoded ids and normalized error fields', async () => {
    fetchApiDataMock.mockResolvedValueOnce({
      key: keyDto,
      ok: false,
      error_code: 'timeout',
      error_message: 'timed out',
    });
    await expect(testAdminOcrKey('key 1')).resolves.toEqual({
      key: expect.objectContaining({ id: 'key-1' }),
      ok: false,
      errorCode: 'timeout',
      errorMessage: 'timed out',
    });
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/ocr-keys/key%201/test', {
      method: 'POST',
    });

    fetchApiDataMock.mockResolvedValueOnce({
      key: keyDto,
      ok: true,
      error_code: undefined,
      error_message: undefined,
    });
    await expect(testAdminOcrKey('key-1')).resolves.toMatchObject({
      ok: true,
      errorCode: null,
      errorMessage: null,
    });

    fetchApiDataMock.mockResolvedValueOnce({ deleted: true });
    await expect(deleteAdminOcrKey('key/2')).resolves.toEqual({ deleted: true });
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/admin/ocr-keys/key%2F2', {
      method: 'DELETE',
    });
  });
});
