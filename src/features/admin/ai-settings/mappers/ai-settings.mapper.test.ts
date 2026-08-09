import { describe, expect, it } from 'vitest';
import { toAiSettingsViewModel } from './ai-settings.mapper';
import type {
  AiSettingsSnapshotDto,
  CredentialDto,
} from '@/features/admin/ai-settings/types/ai-settings';

describe('AI settings mapper', () => {
  it('whitelists masked credential metadata and never carries secret fields into UI state', () => {
    const dto: AiSettingsSnapshotDto & {
      credentials: Array<CredentialDto & { api_key: string; ciphertext: string }>;
    } = {
      revision: 4,
      actions: [],
      pipeline_steps: [],
      providers: [],
      credentials: [
        {
          key_id: 'key-1',
          provider_id: 'provider-1',
          label: 'Primary',
          masked_key: 'sk-••••abcd',
          priority: 10,
          enabled: true,
          secret_version: 2,
          api_key: 'must-not-survive',
          ciphertext: 'must-not-survive',
        },
      ],
      models: [],
      routes: [],
      step_policies: [],
    };

    const viewModel = toAiSettingsViewModel(dto);
    const serialized = JSON.stringify(viewModel);

    expect(viewModel.credentials[0]).toMatchObject({
      id: 'key-1',
      maskedKey: 'sk-••••abcd',
      priority: 10,
    });
    expect(serialized).not.toContain('must-not-survive');
    expect(serialized).not.toContain('api_key');
    expect(serialized).not.toContain('ciphertext');
  });
});
