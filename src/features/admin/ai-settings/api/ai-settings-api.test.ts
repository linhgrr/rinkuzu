import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchApiResponseMock } = vi.hoisted(() => ({ fetchApiResponseMock: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ fetchApiResponse: fetchApiResponseMock }));

import {
  replaceCredentialSecret,
  saveRouting,
} from '@/features/admin/ai-settings/api/ai-settings-api';

describe('AI settings API', () => {
  beforeEach(() => {
    fetchApiResponseMock.mockReset().mockResolvedValue({ data: {}, meta: { revision: 8 } });
  });

  it('URL-encodes dynamic IDs and sends secret replacement only in the JSON body', async () => {
    await replaceCredentialSecret('provider/one', 'key one', 'secret-value', 7);

    expect(fetchApiResponseMock).toHaveBeenCalledWith(
      '/api/admin/ai-settings/providers/provider%2Fone/keys/key%20one/secret',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': '"llm-config-7"',
        },
        body: JSON.stringify({ api_key: 'secret-value' }),
      }),
    );
  });

  it('saves routes and step policies in one atomic PUT', async () => {
    const payload = {
      routes: [{ action: 'adaptive_exercise' as const, model_ids: ['model-1', 'model-2'] }],
      step_policies: [{ step_id: 'relation_verification' as const, enabled: false }],
    };

    await saveRouting(payload, 7);

    expect(fetchApiResponseMock).toHaveBeenCalledWith(
      '/api/admin/ai-settings/routing',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(payload) }),
    );
  });
});
