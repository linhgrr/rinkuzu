/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiSettingsViewModel } from '@/features/admin/ai-settings/types/ai-settings';

const { fetchAiSettingsMock, saveRoutingMock, translateMock } = vi.hoisted(() => ({
  fetchAiSettingsMock: vi.fn(),
  saveRoutingMock: vi.fn(),
  translateMock: (key: string) => key,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => translateMock,
}));

vi.mock('@/features/admin/ai-settings/api/ai-settings-api', () => ({
  createCredential: vi.fn(),
  createModel: vi.fn(),
  createProvider: vi.fn(),
  deleteCredential: vi.fn(),
  deleteModel: vi.fn(),
  deleteProvider: vi.fn(),
  discoverModels: vi.fn(),
  fetchAiSettings: fetchAiSettingsMock,
  patchCredential: vi.fn(),
  patchModel: vi.fn(),
  patchProvider: vi.fn(),
  replaceCredentialSecret: vi.fn(),
  saveRouting: saveRoutingMock,
  testCredential: vi.fn(),
  testModel: vi.fn(),
  testProvider: vi.fn(),
}));

import { AiSettingsClient } from '@/features/admin/ai-settings/components/AiSettingsClient';

const snapshot: AiSettingsViewModel = {
  revision: 7,
  actions: [
    {
      action: 'quiz_extraction',
      group: 'quiz',
      label: 'Quiz extraction',
      description: 'Extracts a structured quiz.',
      required_capabilities: ['structured_output'],
    },
  ],
  pipelineSteps: [
    {
      step_id: 'theory_generation',
      label: 'Theory generation',
      required: false,
      default_enabled: true,
      llm_action: 'pipeline_theory_generation',
      bypass_kind: 'skip_theory_generation',
    },
  ],
  providers: [
    {
      id: 'provider-a',
      name: 'Provider One',
      origin: 'https://one.example',
      baseUrl: 'https://one.example/v1',
      enabled: true,
      timeoutSec: 60,
    },
    {
      id: 'provider-b',
      name: 'Provider Two',
      origin: 'https://two.example',
      baseUrl: 'https://two.example/v1',
      enabled: true,
      timeoutSec: 45,
    },
  ],
  credentials: [
    {
      id: 'key-a',
      providerId: 'provider-a',
      label: 'Primary',
      maskedKey: 'sk-••••1111',
      priority: 1,
      enabled: true,
      secretVersion: 1,
      healthStatus: 'healthy',
      successCount: 1,
      failureCount: 0,
      lastUsedAt: null,
      lastErrorCode: null,
    },
    {
      id: 'key-b',
      providerId: 'provider-b',
      label: 'Secondary',
      maskedKey: 'sk-••••2222',
      priority: 1,
      enabled: true,
      secretVersion: 1,
      healthStatus: 'healthy',
      successCount: 1,
      failureCount: 0,
      lastUsedAt: null,
      lastErrorCode: null,
    },
  ],
  models: [
    {
      id: 'text-only',
      providerId: 'provider-a',
      displayName: 'Text Only',
      upstreamName: 'text-only',
      enabled: true,
      capabilities: ['text'],
      timeoutSec: null,
      inputPrice: null,
      outputPrice: null,
    },
    {
      id: 'structured-a',
      providerId: 'provider-a',
      displayName: 'Structured A',
      upstreamName: 'structured-a',
      enabled: true,
      capabilities: ['text', 'structured_output'],
      timeoutSec: null,
      inputPrice: null,
      outputPrice: null,
    },
    {
      id: 'structured-b',
      providerId: 'provider-b',
      displayName: 'Structured B',
      upstreamName: 'structured-b',
      enabled: true,
      capabilities: ['text', 'structured_output'],
      timeoutSec: null,
      inputPrice: null,
      outputPrice: null,
    },
  ],
  routes: [{ action: 'quiz_extraction', model_ids: ['structured-a', 'structured-b'] }],
  stepPolicies: [{ step_id: 'theory_generation', enabled: true }],
};

describe('AiSettingsClient', () => {
  beforeEach(() => {
    fetchAiSettingsMock.mockResolvedValue(snapshot);
    saveRoutingMock.mockResolvedValue({ data: {}, revision: 8 });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('supports provider master/detail selection and renders masked keys only', async () => {
    const user = userEvent.setup();
    render(<AiSettingsClient />);

    await user.click(await screen.findByRole('button', { name: /Provider Two/ }));
    expect(screen.getByRole('heading', { name: 'Provider Two' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'aiSettingsTab_keys' }));
    expect(screen.getByText('sk-••••2222')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('plaintext-secret');
  });

  it('clears a typed secret when the admin leaves the keys tab', async () => {
    const user = userEvent.setup();
    render(<AiSettingsClient />);

    await user.click(await screen.findByRole('button', { name: 'aiSettingsTab_keys' }));
    const secret = screen.getByPlaceholderText('aiSettingsApiKey');
    await user.type(secret, 'plaintext-secret');
    expect(secret).toHaveValue('plaintext-secret');

    await user.click(screen.getByRole('button', { name: 'aiSettingsTab_models' }));
    await user.click(screen.getByRole('button', { name: 'aiSettingsTab_keys' }));
    expect(screen.getByPlaceholderText('aiSettingsApiKey')).toHaveValue('');
  });

  it('filters incompatible choices and preserves exact fallback order when moving a model', async () => {
    const user = userEvent.setup();
    render(<AiSettingsClient initialTab="routing" />);

    const addModel = await screen.findByRole('combobox');
    expect(addModel).not.toContainElement(screen.queryByRole('option', { name: 'Text Only' }));

    const [moveDown] = screen.getAllByRole('button', { name: 'aiSettingsMoveDown' });
    if (!moveDown) throw new Error('Expected an enabled move-down button.');
    await user.click(moveDown);
    await user.click(screen.getByRole('button', { name: 'aiSettingsSaveRouting' }));

    await waitFor(() => {
      expect(saveRoutingMock).toHaveBeenCalledWith(
        expect.objectContaining({
          routes: [{ action: 'quiz_extraction', model_ids: ['structured-b', 'structured-a'] }],
          step_policies: [{ step_id: 'theory_generation', enabled: true }],
        }),
        7,
      );
    });
  });
});
