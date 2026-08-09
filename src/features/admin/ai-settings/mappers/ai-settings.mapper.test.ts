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

  it('maps cache-aware model pricing from the generated backend contract', () => {
    const dto: AiSettingsSnapshotDto = {
      revision: 1,
      actions: [],
      pipeline_steps: [],
      providers: [],
      credentials: [],
      models: [
        {
          model_id: 'model-1',
          provider_id: 'provider-1',
          display_name: 'Model 1',
          upstream_model_name: 'model-1',
          enabled: true,
          capabilities: ['text'],
          input_price_usd_per_m_tokens: '0.14',
          input_cache_hit_price_usd_per_m_tokens: '0.0028',
          output_price_usd_per_m_tokens: '0.28',
        },
      ],
      routes: [],
      step_policies: [],
    };

    expect(toAiSettingsViewModel(dto).models[0]).toMatchObject({
      inputPrice: '0.14',
      cacheHitPrice: '0.0028',
      outputPrice: '0.28',
    });
  });
});
