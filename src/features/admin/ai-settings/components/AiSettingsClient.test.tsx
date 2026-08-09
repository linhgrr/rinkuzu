/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiSettingsViewModel } from '@/features/admin/ai-settings/types/ai-settings';

const {
  deleteModelMock,
  fetchAiSettingsMock,
  patchModelMock,
  saveRoutingMock,
  testProviderMock,
  translateMock,
} = vi.hoisted(() => ({
  deleteModelMock: vi.fn(),
  fetchAiSettingsMock: vi.fn(),
  patchModelMock: vi.fn(),
  saveRoutingMock: vi.fn(),
  testProviderMock: vi.fn(),
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
  deleteModel: deleteModelMock,
  deleteProvider: vi.fn(),
  discoverModels: vi.fn(),
  fetchAiSettings: fetchAiSettingsMock,
  patchCredential: vi.fn(),
  patchModel: patchModelMock,
  patchProvider: vi.fn(),
  replaceCredentialSecret: vi.fn(),
  saveRouting: saveRoutingMock,
  testCredential: vi.fn(),
  testModel: vi.fn(),
  testProvider: testProviderMock,
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
      cacheHitPrice: null,
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
      cacheHitPrice: null,
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
      cacheHitPrice: null,
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
    patchModelMock.mockResolvedValue({ data: {}, revision: 8 });
    testProviderMock.mockResolvedValue({ data: { ok: true } });
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

    await user.click(screen.getByRole('tab', { name: 'aiSettingsTab_keys' }));
    expect(screen.getByText('sk-••••2222')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('plaintext-secret');
  });

  it('clears a typed secret when the admin leaves the keys tab', async () => {
    const user = userEvent.setup();
    render(<AiSettingsClient />);

    await user.click(await screen.findByRole('tab', { name: 'aiSettingsTab_keys' }));
    const secret = screen.getByLabelText('aiSettingsApiKey');
    await user.type(secret, 'plaintext-secret');
    expect(secret).toHaveValue('plaintext-secret');

    await user.click(screen.getByRole('tab', { name: 'aiSettingsTab_models' }));
    await user.click(screen.getByRole('tab', { name: 'aiSettingsTab_keys' }));
    expect(screen.getByLabelText('aiSettingsApiKey')).toHaveValue('');
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

  it('supports keyboard navigation between provider tabs', async () => {
    const user = userEvent.setup();
    render(<AiSettingsClient />);

    const providerTab = await screen.findByRole('tab', { name: 'aiSettingsTab_provider' });
    providerTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'aiSettingsTab_keys' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('article', { name: 'Primary' })).toBeInTheDocument();
  });

  it('preserves an unsaved routing draft while probing a provider', async () => {
    const user = userEvent.setup();
    render(<AiSettingsClient initialTab="routing" />);

    const [moveDown] = await screen.findAllByRole('button', { name: 'aiSettingsMoveDown' });
    if (!moveDown) throw new Error('Expected an enabled move-down button.');
    await user.click(moveDown);
    await user.click(screen.getByRole('button', { name: 'aiSettingsProviders' }));

    const probe = await screen.findByRole('button', { name: 'aiSettingsTest' });
    await waitFor(() => expect(probe).toBeEnabled());
    await user.click(probe);
    await waitFor(() => expect(testProviderMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'aiSettingsGlobalRouting' }));
    await user.click(screen.getByRole('button', { name: 'aiSettingsSaveRouting' }));
    await waitFor(() =>
      expect(saveRoutingMock).toHaveBeenCalledWith(
        expect.objectContaining({
          routes: [{ action: 'quiz_extraction', model_ids: ['structured-b', 'structured-a'] }],
        }),
        7,
      ),
    );
  });

  it('asks for confirmation before deleting a model', async () => {
    const user = userEvent.setup();
    render(<AiSettingsClient />);

    await user.click(await screen.findByRole('tab', { name: 'aiSettingsTab_models' }));
    const modelCard = screen.getByRole('article', { name: 'Structured A' });
    await user.click(within(modelCard).getByRole('button', { name: 'delete' }));

    expect(screen.getByRole('alertdialog', { name: 'aiSettingsDeleteModelTitle' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'cancel' }));
    expect(deleteModelMock).not.toHaveBeenCalled();
  });

  it('edits model pricing with an optional cache-hit rate', async () => {
    const user = userEvent.setup();
    render(<AiSettingsClient />);

    await user.click(await screen.findByRole('tab', { name: 'aiSettingsTab_models' }));
    const modelCard = screen.getByRole('article', { name: 'Structured A' });
    await user.click(within(modelCard).getByRole('button', { name: 'aiSettingsEditPricing' }));

    const editor = within(modelCard).getByRole('form', {
      name: 'aiSettingsPricingEditor',
    });
    const pricingEditor = within(editor);
    const inputPrice = pricingEditor.getByLabelText('aiSettingsInputMissPrice');
    const cacheHitPrice = pricingEditor.getByLabelText('aiSettingsCacheHitPrice');
    const outputPrice = pricingEditor.getByLabelText('aiSettingsOutputPrice');
    await user.type(inputPrice, '0.14');
    expect(pricingEditor.getByRole('button', { name: 'aiSettingsSavePricing' })).toBeDisabled();
    expect(pricingEditor.getByText('aiSettingsCachePricingInvalid')).toBeVisible();

    await user.type(outputPrice, '0.28');
    await user.type(cacheHitPrice, '0.0028');
    await user.click(pricingEditor.getByRole('button', { name: 'aiSettingsSavePricing' }));

    await waitFor(() =>
      expect(patchModelMock).toHaveBeenCalledWith(
        'provider-a',
        'structured-a',
        {
          input_price_usd_per_m_tokens: '0.14',
          input_cache_hit_price_usd_per_m_tokens: '0.0028',
          output_price_usd_per_m_tokens: '0.28',
        },
        7,
      ),
    );
  });

  it('uses a compact workspace navigation instead of rendering the page subtitle', async () => {
    render(<AiSettingsClient />);

    expect(
      await screen.findByRole('navigation', { name: 'aiSettingsWorkspaceNavigation' }),
    ).toBeVisible();
    expect(screen.queryByText('aiSettingsDescription')).not.toBeInTheDocument();
  });
});
