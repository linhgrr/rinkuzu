import { describe, expect, it } from 'vitest';
import { toAdminOcrKeysViewModel } from './admin-ocr-keys.mapper';

describe('toAdminOcrKeysViewModel', () => {
  it('maps OCR key payload without exposing raw key fields', () => {
    const viewModel = toAdminOcrKeysViewModel({
      fallback_env_configured: true,
      keys: [
        {
          key_id: 'key-1',
          provider: 'landingai',
          label: 'Primary',
          masked_key: 'land••••••••1234',
          enabled: true,
          health_status: 'healthy',
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
        },
      ],
    });

    expect(viewModel.fallbackEnvConfigured).toBe(true);
    expect(viewModel.activeKeyCount).toBe(1);
    expect(viewModel.keys[0]).toMatchObject({
      id: 'key-1',
      maskedKey: 'land••••••••1234',
      successCount: 4,
      failureCount: 1,
    });
    expect(viewModel.keys[0]).not.toHaveProperty('apiKey');
    expect(viewModel.keys[0]).not.toHaveProperty('encryptedKey');
  });
});
