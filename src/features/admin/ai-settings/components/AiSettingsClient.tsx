'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { Button } from '@/components/ui/Button';
import { ApiResponseError } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import {
  createCredential,
  createModel,
  createProvider,
  deleteProvider,
  fetchAiSettings,
  patchProvider,
  saveRouting,
  testProvider,
} from '@/features/admin/ai-settings/api/ai-settings-api';
import type { AiSettingsViewModel } from '@/features/admin/ai-settings/types/ai-settings';
import {
  PipelineRoutingPanel,
  type DraftRoutes,
  type DraftSteps,
} from '@/features/admin/ai-settings/components/PipelineRoutingPanel';
import {
  ProviderKeysPanel,
  type KeyFormState,
} from '@/features/admin/ai-settings/components/ProviderKeysPanel';
import {
  ProviderModelsPanel,
  type ModelFormState,
} from '@/features/admin/ai-settings/components/ProviderModelsPanel';
import {
  ProvidersPanel,
  type ProviderFormState,
} from '@/features/admin/ai-settings/components/ProvidersPanel';
import { ProviderDetail } from '@/features/admin/ai-settings/components/ProviderDetail';

type DetailTab = 'provider' | 'keys' | 'models' | 'routing';

function routeDraft(snapshot: AiSettingsViewModel): DraftRoutes {
  return Object.fromEntries(snapshot.actions.map(({ action }) => [action, []])) as DraftRoutes;
}

export function AiSettingsClient({
  initialTab = 'provider',
  initialProviderId = null,
}: {
  initialTab?: DetailTab;
  initialProviderId?: string | null;
}) {
  const t = useTranslations('admin');
  const [snapshot, setSnapshot] = useState<AiSettingsViewModel | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(initialProviderId);
  const selectedProviderIdRef = useRef<string | null>(initialProviderId);
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [providerForm, setProviderForm] = useState<ProviderFormState>({
    name: '',
    baseUrl: '',
    timeout: '60',
    enabled: true,
  });
  const [providerEdit, setProviderEdit] = useState<ProviderFormState>({
    name: '',
    baseUrl: '',
    timeout: '60',
    enabled: true,
  });
  const [keyForm, setKeyForm] = useState<KeyFormState>({
    label: '',
    apiKey: '',
    priority: '100',
  });
  const [modelForm, setModelForm] = useState<ModelFormState>({
    displayName: '',
    upstreamName: '',
    capabilities: ['text'],
    timeout: '',
    inputPrice: '',
    outputPrice: '',
    enabled: true,
  });
  const [replacementSecrets, setReplacementSecrets] = useState<Record<string, string>>({});
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [draftRoutes, setDraftRoutes] = useState<DraftRoutes>({});
  const [draftSteps, setDraftSteps] = useState<DraftSteps>({});

  const load = useCallback(async (signal?: AbortSignal) => {
    const data = await fetchAiSettings(signal);
    setSnapshot(data);
    const current = selectedProviderIdRef.current;
    const nextProviderId =
      current && data.providers.some((provider) => provider.id === current)
        ? current
        : (data.providers[0]?.id ?? null);
    selectedProviderIdRef.current = nextProviderId;
    setSelectedProviderId(nextProviderId);
    const nextProvider = data.providers.find((provider) => provider.id === nextProviderId);
    if (nextProvider) {
      setProviderEdit({
        name: nextProvider.name,
        baseUrl: nextProvider.baseUrl,
        timeout: String(nextProvider.timeoutSec),
        enabled: nextProvider.enabled,
      });
    }
    const routes = routeDraft(data);
    for (const route of data.routes) routes[route.action] = [...route.model_ids];
    setDraftRoutes(routes);
    setDraftSteps(
      Object.fromEntries(
        data.pipelineSteps.map((step) => [
          step.step_id,
          data.stepPolicies.find((policy) => policy.step_id === step.step_id)?.enabled ??
            step.default_enabled,
        ]),
      ),
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(controller.signal)
        .catch((cause) => {
          if (!controller.signal.aborted)
            setError(extractUnknownErrorMessage(cause, t('aiSettingsUnexpectedError')));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, t]);

  const selectedProvider = snapshot?.providers.find(
    (provider) => provider.id === selectedProviderId,
  );
  const providerKeys = useMemo(
    () => snapshot?.credentials.filter((key) => key.providerId === selectedProviderId) ?? [],
    [snapshot, selectedProviderId],
  );
  const providerModels = useMemo(
    () => snapshot?.models.filter((model) => model.providerId === selectedProviderId) ?? [],
    [snapshot, selectedProviderId],
  );
  const routingDirty = useMemo(() => {
    if (!snapshot) return false;
    const savedRoutes = routeDraft(snapshot);
    for (const route of snapshot.routes) savedRoutes[route.action] = [...route.model_ids];
    const savedSteps = Object.fromEntries(
      snapshot.pipelineSteps.map((step) => [
        step.step_id,
        snapshot.stepPolicies.find((policy) => policy.step_id === step.step_id)?.enabled ??
          step.default_enabled,
      ]),
    );
    return (
      JSON.stringify(savedRoutes) !== JSON.stringify(draftRoutes) ||
      JSON.stringify(savedSteps) !== JSON.stringify(draftSteps)
    );
  }, [draftRoutes, draftSteps, snapshot]);

  useEffect(() => {
    if (!routingDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [routingDirty]);

  function clearSecrets() {
    setKeyForm((value) => ({ ...value, apiKey: '' }));
    setReplacementSecrets({});
  }

  function selectProvider(provider: AiSettingsViewModel['providers'][number]) {
    selectedProviderIdRef.current = provider.id;
    setSelectedProviderId(provider.id);
    setProviderEdit({
      name: provider.name,
      baseUrl: provider.baseUrl,
      timeout: String(provider.timeoutSec),
      enabled: provider.enabled,
    });
    clearSecrets();
  }

  function selectTab(value: DetailTab) {
    setTab(value);
    if (value !== 'keys') clearSecrets();
  }

  async function mutate(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
      await load();
      setNotice(success);
    } catch (cause) {
      if (cause instanceof ApiResponseError && [412, 428].includes(cause.status)) {
        await load();
        setError(t('aiSettingsStale'));
      } else {
        setError(extractUnknownErrorMessage(cause, t('aiSettingsUnexpectedError')));
      }
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  async function submitProvider(event: FormEvent) {
    event.preventDefault();
    if (!snapshot) return;
    try {
      await mutate(
        () =>
          createProvider(
            {
              name: providerForm.name.trim(),
              base_url: providerForm.baseUrl.trim(),
              timeout_sec: Number(providerForm.timeout),
              enabled: providerForm.enabled,
            },
            snapshot.revision,
          ),
        t('aiSettingsSaved'),
      );
      setProviderForm({ name: '', baseUrl: '', timeout: '60', enabled: true });
    } catch {
      // mutate owns the visible error.
    }
  }

  async function submitKey(event: FormEvent) {
    event.preventDefault();
    if (!snapshot || !selectedProvider) return;
    try {
      await mutate(
        () =>
          createCredential(
            selectedProvider.id,
            {
              label: keyForm.label.trim(),
              api_key: keyForm.apiKey,
              priority: Number(keyForm.priority),
              enabled: true,
            },
            snapshot.revision,
          ),
        t('aiSettingsSaved'),
      );
      setKeyForm({ label: '', apiKey: '', priority: '100' });
    } catch {
      // Secret remains only long enough for the admin to retry this failed save.
    }
  }

  async function submitModel(event: FormEvent) {
    event.preventDefault();
    if (!snapshot || !selectedProvider) return;
    try {
      await mutate(
        () =>
          createModel(
            selectedProvider.id,
            {
              display_name: modelForm.displayName.trim(),
              upstream_model_name: modelForm.upstreamName.trim(),
              enabled: modelForm.enabled,
              capabilities: modelForm.capabilities,
              timeout_sec_override: modelForm.timeout ? Number(modelForm.timeout) : null,
              input_price_usd_per_m_tokens: modelForm.inputPrice || null,
              output_price_usd_per_m_tokens: modelForm.outputPrice || null,
            },
            snapshot.revision,
          ),
        t('aiSettingsSaved'),
      );
      setModelForm({
        displayName: '',
        upstreamName: '',
        capabilities: ['text'],
        timeout: '',
        inputPrice: '',
        outputPrice: '',
        enabled: true,
      });
    } catch {
      // mutate owns the visible error.
    }
  }

  if (loading) {
    return <AdminPageShell>{t('loading')}</AdminPageShell>;
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={t('aiSettingsTitle')}
        description={t('aiSettingsDescription')}
        actions={
          <Button variant="secondary" onClick={() => void load()} disabled={busy}>
            {t('refresh')}
          </Button>
        }
      />

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-error-surface p-3 text-sm text-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-4 rounded-lg bg-success-surface p-3 text-sm text-success">{notice}</p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        {snapshot ? (
          <ProvidersPanel
            busy={busy}
            form={providerForm}
            onSelect={selectProvider}
            onSubmit={submitProvider}
            selectedProviderId={selectedProviderId}
            setForm={setProviderForm}
            snapshot={snapshot}
          />
        ) : null}

        <section className="min-w-0 overflow-hidden rounded-xl border border-line bg-white p-4 sm:p-5">
          {!selectedProvider || !snapshot ? (
            <p className="text-neutral-500">{t('aiSettingsSelectProvider')}</p>
          ) : (
            <>
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 basis-64">
                  <h2 className="break-words text-xl font-semibold leading-snug">
                    {selectedProvider.name}
                  </h2>
                  <p className="mt-1 break-all text-sm text-neutral-500">
                    {selectedProvider.baseUrl}
                  </p>
                </div>
                <div className="flex max-w-full flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={busy || !providerKeys[0]}
                    onClick={() => {
                      const key = providerKeys[0];
                      if (key)
                        void mutate(
                          () => testProvider(selectedProvider.id, { key_id: key.id }),
                          t('aiSettingsProbePassed'),
                        ).catch(() => undefined);
                    }}
                  >
                    {t('aiSettingsTest')}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        () =>
                          patchProvider(
                            selectedProvider.id,
                            { enabled: !selectedProvider.enabled },
                            snapshot.revision,
                          ),
                        t('aiSettingsSaved'),
                      ).catch(() => undefined)
                    }
                  >
                    {selectedProvider.enabled ? t('disable') : t('enable')}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(t('aiSettingsDeleteProviderConfirm'))) {
                        void mutate(
                          () => deleteProvider(selectedProvider.id, snapshot.revision),
                          t('aiSettingsDeleted'),
                        ).catch(() => undefined);
                      }
                    }}
                  >
                    {t('delete')}
                  </Button>
                </div>
              </div>

              <div className="my-5 flex flex-wrap gap-2 border-b border-line pb-3">
                {(['provider', 'keys', 'models', 'routing'] as const).map((value) => (
                  <Button
                    key={value}
                    variant={tab === value ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => selectTab(value)}
                  >
                    {t(`aiSettingsTab_${value}`)}
                  </Button>
                ))}
              </div>

              {tab === 'provider' ? (
                <ProviderDetail
                  busy={busy}
                  edit={providerEdit}
                  mutate={mutate}
                  provider={selectedProvider}
                  revision={snapshot.revision}
                  setEdit={setProviderEdit}
                />
              ) : null}

              {tab === 'keys' ? (
                <ProviderKeysPanel
                  busy={busy}
                  keyForm={keyForm}
                  keys={providerKeys}
                  mutate={mutate}
                  onSubmit={submitKey}
                  provider={selectedProvider}
                  replacementSecrets={replacementSecrets}
                  revision={snapshot.revision}
                  setKeyForm={setKeyForm}
                  setReplacementSecrets={setReplacementSecrets}
                />
              ) : null}

              {tab === 'models' ? (
                <ProviderModelsPanel
                  busy={busy}
                  discoveredModels={discoveredModels}
                  keys={providerKeys}
                  modelForm={modelForm}
                  models={providerModels}
                  mutate={mutate}
                  onSubmit={submitModel}
                  provider={selectedProvider}
                  revision={snapshot.revision}
                  setDiscoveredModels={setDiscoveredModels}
                  setError={setError}
                  setModelForm={setModelForm}
                  setNotice={setNotice}
                />
              ) : null}

              {tab === 'routing' ? (
                <PipelineRoutingPanel
                  busy={busy}
                  draftRoutes={draftRoutes}
                  draftSteps={draftSteps}
                  routingDirty={routingDirty}
                  setDraftRoutes={setDraftRoutes}
                  setDraftSteps={setDraftSteps}
                  snapshot={snapshot}
                  onSave={() =>
                    void mutate(
                      () =>
                        saveRouting(
                          {
                            routes: snapshot.actions.map(({ action }) => ({
                              action,
                              model_ids: draftRoutes[action] ?? [],
                            })),
                            step_policies: snapshot.pipelineSteps.map((step) => ({
                              step_id: step.step_id,
                              enabled: draftSteps[step.step_id] ?? step.default_enabled,
                            })),
                          },
                          snapshot.revision,
                        ),
                      t('aiSettingsSaved'),
                    ).catch(() => undefined)
                  }
                  onDiscard={() => {
                    const routes = routeDraft(snapshot);
                    for (const route of snapshot.routes)
                      routes[route.action] = [...route.model_ids];
                    setDraftRoutes(routes);
                    setDraftSteps(
                      Object.fromEntries(
                        snapshot.pipelineSteps.map((step) => [
                          step.step_id,
                          snapshot.stepPolicies.find((policy) => policy.step_id === step.step_id)
                            ?.enabled ?? step.default_enabled,
                        ]),
                      ),
                    );
                  }}
                />
              ) : null}
            </>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}
