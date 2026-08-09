'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ApiResponseError } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import {
  createCredential,
  createModel,
  createProvider,
  deleteCredential,
  deleteModel,
  deleteProvider,
  discoverModels,
  fetchAiSettings,
  patchCredential,
  patchModel,
  patchProvider,
  replaceCredentialSecret,
  saveRouting,
  testCredential,
  testModel,
  testProvider,
} from '@/features/admin/ai-settings/api/ai-settings-api';
import type {
  AiSettingsViewModel,
  LlmAction,
  LlmCapability,
} from '@/features/admin/ai-settings/types/ai-settings';

type DetailTab = 'provider' | 'keys' | 'models' | 'routing';
type DraftRoutes = Record<string, string[]>;
type DraftSteps = Record<string, boolean>;

const FIELD =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand-trust';
const CAPABILITIES = [
  'text',
  'structured_output',
  'streaming',
  'vision',
] as const satisfies readonly LlmCapability[];

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
  const [providerForm, setProviderForm] = useState({
    name: '',
    baseUrl: '',
    timeout: '60',
    enabled: true,
  });
  const [providerEdit, setProviderEdit] = useState({
    name: '',
    baseUrl: '',
    timeout: '60',
    enabled: true,
  });
  const [keyForm, setKeyForm] = useState({ label: '', apiKey: '', priority: '100' });
  const [modelForm, setModelForm] = useState<{
    displayName: string;
    upstreamName: string;
    capabilities: LlmCapability[];
    timeout: string;
    inputPrice: string;
    outputPrice: string;
    enabled: boolean;
  }>({
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

  function moveModel(action: string, index: number, delta: -1 | 1) {
    setDraftRoutes((current) => {
      const chain = [...(current[action] ?? [])];
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= chain.length) return current;
      const currentItem = chain[index];
      const nextItem = chain[nextIndex];
      if (currentItem === undefined || nextItem === undefined) return current;
      chain[index] = nextItem;
      chain[nextIndex] = currentItem;
      return { ...current, [action]: chain };
    });
  }

  function routeInvalid(action: LlmAction, modelIds: string[]): boolean {
    if (!snapshot || modelIds.length === 0 || new Set(modelIds).size !== modelIds.length)
      return true;
    const required =
      snapshot.actions.find((definition) => definition.action === action)?.required_capabilities ??
      [];
    return modelIds.some((id) => {
      const model = snapshot.models.find((candidate) => candidate.id === id);
      const provider = model
        ? snapshot.providers.find((candidate) => candidate.id === model.providerId)
        : undefined;
      const hasEnabledKey = model
        ? snapshot.credentials.some(
            (credential) => credential.providerId === model.providerId && credential.enabled,
          )
        : false;
      return (
        !model ||
        !model.enabled ||
        !provider?.enabled ||
        !hasEnabledKey ||
        required.some((capability) => !model.capabilities.includes(capability))
      );
    });
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
        <aside className="space-y-4 rounded-xl border border-line bg-white p-4">
          <h2 className="text-lg font-semibold">{t('aiSettingsProviders')}</h2>
          <div className="space-y-2">
            {snapshot?.providers.map((provider) => {
              const keys = snapshot.credentials.filter((key) => key.providerId === provider.id);
              const models = snapshot.models.filter((model) => model.providerId === provider.id);
              return (
                <Button
                  key={provider.id}
                  variant="ghost"
                  onClick={() => selectProvider(provider)}
                  className={`h-auto w-full justify-start rounded-lg border p-3 text-left ${provider.id === selectedProviderId ? 'border-accent bg-accent-soft' : 'border-line'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 font-medium">
                      {provider.name}
                      <span className={provider.enabled ? 'text-success' : 'text-ink-muted'}>
                        {provider.enabled ? t('active') : t('inactive')}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-ink-muted">
                      {provider.origin}
                    </span>
                    <span className="mt-2 block text-xs text-ink-muted">
                      {t('aiSettingsProviderCounts', { keys: keys.length, models: models.length })}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
          <form className="space-y-2 border-t border-line pt-4" onSubmit={submitProvider}>
            <input
              className={FIELD}
              required
              placeholder={t('aiSettingsProviderName')}
              value={providerForm.name}
              onChange={(event) =>
                setProviderForm((value) => ({ ...value, name: event.target.value }))
              }
            />
            <input
              className={FIELD}
              required
              type="url"
              placeholder="https://api.example.com/v1"
              value={providerForm.baseUrl}
              onChange={(event) =>
                setProviderForm((value) => ({ ...value, baseUrl: event.target.value }))
              }
            />
            <input
              className={FIELD}
              required
              type="number"
              min="1"
              max="300"
              value={providerForm.timeout}
              onChange={(event) =>
                setProviderForm((value) => ({ ...value, timeout: event.target.value }))
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={providerForm.enabled}
                onChange={(event) =>
                  setProviderForm((value) => ({ ...value, enabled: event.target.checked }))
                }
              />
              {t('aiSettingsProviderEnabled')}
            </label>
            <p className="rounded-lg bg-warning-surface p-2 text-xs text-warning">
              {t('aiSettingsEgressWarning')}
            </p>
            <Button type="submit" className="w-full" loading={busy}>
              {t('aiSettingsAddProvider')}
            </Button>
          </form>
        </aside>

        <section className="min-w-0 rounded-xl border border-line bg-white p-5">
          {!selectedProvider || !snapshot ? (
            <p className="text-neutral-500">{t('aiSettingsSelectProvider')}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{selectedProvider.name}</h2>
                  <p className="mt-1 break-all text-sm text-neutral-500">
                    {selectedProvider.baseUrl}
                  </p>
                </div>
                <div className="flex gap-2">
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
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void mutate(
                      () =>
                        patchProvider(
                          selectedProvider.id,
                          {
                            name: providerEdit.name.trim(),
                            base_url: providerEdit.baseUrl.trim(),
                            timeout_sec: Number(providerEdit.timeout),
                            enabled: providerEdit.enabled,
                          },
                          snapshot.revision,
                        ),
                      t('aiSettingsSaved'),
                    ).catch(() => undefined);
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span>{t('aiSettingsProviderName')}</span>
                      <input
                        className={FIELD}
                        required
                        value={providerEdit.name}
                        onChange={(event) =>
                          setProviderEdit((value) => ({ ...value, name: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span>{t('aiSettingsBaseUrl')}</span>
                      <input
                        className={FIELD}
                        required
                        type="url"
                        value={providerEdit.baseUrl}
                        onChange={(event) =>
                          setProviderEdit((value) => ({ ...value, baseUrl: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span>{t('aiSettingsTimeout')}</span>
                      <input
                        className={FIELD}
                        required
                        type="number"
                        min="1"
                        max="300"
                        value={providerEdit.timeout}
                        onChange={(event) =>
                          setProviderEdit((value) => ({ ...value, timeout: event.target.value }))
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2 self-end pb-2 text-sm">
                      <input
                        type="checkbox"
                        checked={providerEdit.enabled}
                        onChange={(event) =>
                          setProviderEdit((value) => ({ ...value, enabled: event.target.checked }))
                        }
                      />
                      {t('aiSettingsProviderEnabled')}
                    </label>
                  </div>
                  <p className="rounded-lg bg-warning-surface p-3 text-sm text-warning">
                    {t('aiSettingsEgressWarning')}
                  </p>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase text-neutral-500">
                        {t('aiSettingsOrigin')}
                      </dt>
                      <dd className="mt-1 break-all">{selectedProvider.origin}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-neutral-500">
                        {t('aiSettingsRevision')}
                      </dt>
                      <dd className="mt-1">{snapshot.revision}</dd>
                    </div>
                  </dl>
                  <Button type="submit" loading={busy}>
                    {t('aiSettingsSaveProvider')}
                  </Button>
                </form>
              ) : null}

              {tab === 'keys' ? (
                <div className="space-y-4">
                  <p className="text-sm text-ink-muted">{t('aiSettingsKeyPriorityHelp')}</p>
                  <form
                    className="grid gap-2 md:grid-cols-[1fr_1fr_100px_auto]"
                    onSubmit={submitKey}
                  >
                    <input
                      className={FIELD}
                      required
                      placeholder={t('aiSettingsKeyLabel')}
                      value={keyForm.label}
                      onChange={(event) =>
                        setKeyForm((value) => ({ ...value, label: event.target.value }))
                      }
                    />
                    <input
                      className={FIELD}
                      required
                      type="password"
                      autoComplete="new-password"
                      placeholder={t('aiSettingsApiKey')}
                      value={keyForm.apiKey}
                      onChange={(event) =>
                        setKeyForm((value) => ({ ...value, apiKey: event.target.value }))
                      }
                    />
                    <input
                      className={FIELD}
                      required
                      type="number"
                      min="0"
                      max="10000"
                      value={keyForm.priority}
                      onChange={(event) =>
                        setKeyForm((value) => ({ ...value, priority: event.target.value }))
                      }
                    />
                    <Button type="submit" loading={busy}>
                      {t('aiSettingsAddKey')}
                    </Button>
                  </form>
                  {providerKeys.map((key) => (
                    <div key={key.id} className="rounded-lg border border-line p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-[16rem] flex-1">
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
                            <input
                              className={FIELD}
                              aria-label={t('aiSettingsKeyLabel')}
                              defaultValue={key.label}
                              onBlur={(event) => {
                                const label = event.target.value.trim();
                                if (label && label !== key.label)
                                  void mutate(
                                    () =>
                                      patchCredential(
                                        selectedProvider.id,
                                        key.id,
                                        { label },
                                        snapshot.revision,
                                      ),
                                    t('aiSettingsSaved'),
                                  ).catch(() => undefined);
                              }}
                            />
                            <input
                              className={FIELD}
                              aria-label={t('aiSettingsKeyPriority')}
                              type="number"
                              min="0"
                              max="10000"
                              defaultValue={key.priority}
                              onBlur={(event) => {
                                const priority = Number(event.target.value);
                                if (Number.isInteger(priority) && priority !== key.priority)
                                  void mutate(
                                    () =>
                                      patchCredential(
                                        selectedProvider.id,
                                        key.id,
                                        { priority },
                                        snapshot.revision,
                                      ),
                                    t('aiSettingsSaved'),
                                  ).catch(() => undefined);
                              }}
                            />
                          </div>
                          <p className="mt-1">
                            <span className="font-mono text-sm">{key.maskedKey}</span>
                          </p>
                          <p className="text-xs text-neutral-500">
                            {t('aiSettingsKeyMeta', {
                              priority: key.priority,
                              health: key.healthStatus,
                            })}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void mutate(
                                () => testCredential(selectedProvider.id, key.id),
                                t('aiSettingsProbePassed'),
                              ).catch(() => undefined)
                            }
                          >
                            {t('aiSettingsTest')}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void mutate(
                                () =>
                                  patchCredential(
                                    selectedProvider.id,
                                    key.id,
                                    { enabled: !key.enabled },
                                    snapshot.revision,
                                  ),
                                t('aiSettingsSaved'),
                              ).catch(() => undefined)
                            }
                          >
                            {key.enabled ? t('disable') : t('enable')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              void mutate(
                                () =>
                                  deleteCredential(selectedProvider.id, key.id, snapshot.revision),
                                t('aiSettingsDeleted'),
                              ).catch(() => undefined)
                            }
                          >
                            {t('delete')}
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          className={FIELD}
                          type="password"
                          autoComplete="new-password"
                          placeholder={t('aiSettingsReplacementKey')}
                          value={replacementSecrets[key.id] ?? ''}
                          onChange={(event) =>
                            setReplacementSecrets((value) => ({
                              ...value,
                              [key.id]: event.target.value,
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!replacementSecrets[key.id]}
                          onClick={() => {
                            const secret = replacementSecrets[key.id];
                            if (!secret) return;
                            void mutate(
                              () =>
                                replaceCredentialSecret(
                                  selectedProvider.id,
                                  key.id,
                                  secret,
                                  snapshot.revision,
                                ),
                              t('aiSettingsSaved'),
                            )
                              .then(() =>
                                setReplacementSecrets((value) => ({ ...value, [key.id]: '' })),
                              )
                              .catch(() => undefined);
                          }}
                        >
                          {t('aiSettingsReplace')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {tab === 'models' ? (
                <div className="space-y-4">
                  <form
                    className="space-y-3 rounded-lg border border-line p-3"
                    onSubmit={submitModel}
                  >
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        className={FIELD}
                        required
                        placeholder={t('aiSettingsModelLabel')}
                        value={modelForm.displayName}
                        onChange={(event) =>
                          setModelForm((value) => ({ ...value, displayName: event.target.value }))
                        }
                      />
                      <input
                        className={FIELD}
                        required
                        placeholder={t('aiSettingsUpstreamModel')}
                        list="discovered-models"
                        value={modelForm.upstreamName}
                        onChange={(event) =>
                          setModelForm((value) => ({ ...value, upstreamName: event.target.value }))
                        }
                      />
                      <input
                        className={FIELD}
                        type="number"
                        min="1"
                        max="300"
                        placeholder={t('aiSettingsModelTimeout')}
                        value={modelForm.timeout}
                        onChange={(event) =>
                          setModelForm((value) => ({ ...value, timeout: event.target.value }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className={FIELD}
                          inputMode="decimal"
                          placeholder={t('aiSettingsInputPrice')}
                          value={modelForm.inputPrice}
                          onChange={(event) =>
                            setModelForm((value) => ({ ...value, inputPrice: event.target.value }))
                          }
                        />
                        <input
                          className={FIELD}
                          inputMode="decimal"
                          placeholder={t('aiSettingsOutputPrice')}
                          value={modelForm.outputPrice}
                          onChange={(event) =>
                            setModelForm((value) => ({ ...value, outputPrice: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium">
                        {t('aiSettingsCapabilities')}
                      </legend>
                      <div className="flex flex-wrap gap-3">
                        {CAPABILITIES.map((capability) => (
                          <label key={capability} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={modelForm.capabilities.includes(capability)}
                              onChange={(event) =>
                                setModelForm((value) => ({
                                  ...value,
                                  capabilities: event.target.checked
                                    ? [...value.capabilities, capability]
                                    : value.capabilities.filter((item) => item !== capability),
                                }))
                              }
                            />
                            {capability}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={modelForm.enabled}
                          onChange={(event) =>
                            setModelForm((value) => ({ ...value, enabled: event.target.checked }))
                          }
                        />
                        {t('active')}
                      </label>
                      <Button
                        type="submit"
                        loading={busy}
                        disabled={modelForm.capabilities.length === 0}
                      >
                        {t('aiSettingsAddModel')}
                      </Button>
                    </div>
                  </form>
                  <datalist id="discovered-models">
                    {discoveredModels.map((id) => (
                      <option key={id} value={id} />
                    ))}
                  </datalist>
                  <Button
                    variant="secondary"
                    disabled={!providerKeys[0]}
                    onClick={() => {
                      const key = providerKeys[0];
                      if (!key) return;
                      void discoverModels(selectedProvider.id, key.id)
                        .then(({ data }) => {
                          setDiscoveredModels(data.model_ids ?? []);
                          setNotice(
                            t('aiSettingsDiscoveryDone', { count: data.model_ids?.length ?? 0 }),
                          );
                        })
                        .catch((cause) =>
                          setError(
                            extractUnknownErrorMessage(cause, t('aiSettingsUnexpectedError')),
                          ),
                        );
                    }}
                  >
                    {t('aiSettingsDiscover')}
                  </Button>
                  {providerModels.map((model) => (
                    <div
                      key={model.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3"
                    >
                      <div>
                        <strong>{model.displayName}</strong>
                        <p className="font-mono text-xs text-neutral-500">{model.upstreamName}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {CAPABILITIES.map((capability) => (
                            <label
                              key={capability}
                              className="flex items-center gap-1 text-xs text-neutral-500"
                            >
                              <input
                                type="checkbox"
                                checked={model.capabilities.includes(capability)}
                                disabled={
                                  busy ||
                                  (model.capabilities.length === 1 &&
                                    model.capabilities[0] === capability)
                                }
                                onChange={(event) => {
                                  const capabilities = event.target.checked
                                    ? [...model.capabilities, capability]
                                    : model.capabilities.filter((item) => item !== capability);
                                  void mutate(
                                    () =>
                                      patchModel(
                                        selectedProvider.id,
                                        model.id,
                                        { capabilities },
                                        snapshot.revision,
                                      ),
                                    t('aiSettingsSaved'),
                                  ).catch(() => undefined);
                                }}
                              />
                              {capability}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!providerKeys[0]}
                          onClick={() => {
                            const key = providerKeys[0];
                            if (key)
                              void mutate(
                                () => testModel(selectedProvider.id, model.id, key.id),
                                t('aiSettingsProbePassed'),
                              ).catch(() => undefined);
                          }}
                        >
                          {t('aiSettingsTest')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void mutate(
                              () =>
                                patchModel(
                                  selectedProvider.id,
                                  model.id,
                                  { enabled: !model.enabled },
                                  snapshot.revision,
                                ),
                              t('aiSettingsSaved'),
                            ).catch(() => undefined)
                          }
                        >
                          {model.enabled ? t('disable') : t('enable')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            void mutate(
                              () => deleteModel(selectedProvider.id, model.id, snapshot.revision),
                              t('aiSettingsDeleted'),
                            ).catch(() => undefined)
                          }
                        >
                          {t('delete')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {tab === 'routing' ? (
                <div className="space-y-5">
                  {snapshot.actions.map((definition) => {
                    const chain = draftRoutes[definition.action] ?? [];
                    const candidates = snapshot.models.filter((model) => {
                      const provider = snapshot.providers.find(
                        (candidate) => candidate.id === model.providerId,
                      );
                      return (
                        model.enabled &&
                        provider?.enabled &&
                        snapshot.credentials.some(
                          (credential) =>
                            credential.providerId === model.providerId && credential.enabled,
                        ) &&
                        definition.required_capabilities.every((capability: LlmCapability) =>
                          model.capabilities.includes(capability),
                        )
                      );
                    });
                    const invalid = routeInvalid(definition.action, chain);
                    const isFirstInGroup =
                      snapshot.actions.findIndex((item) => item.group === definition.group) ===
                      snapshot.actions.indexOf(definition);
                    return (
                      <section key={definition.action} className="space-y-2">
                        {isFirstInGroup ? (
                          <h3 className="text-base font-semibold capitalize">
                            {definition.group.replaceAll('_', ' ')}
                          </h3>
                        ) : null}
                        <div
                          className={`rounded-lg border p-3 ${invalid ? 'border-error' : 'border-line'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span>
                              <strong>{definition.label}</strong>
                              <span className="mt-1 block text-xs text-neutral-500">
                                {definition.description}
                              </span>
                            </span>
                            <span className="text-xs text-neutral-500">
                              {definition.required_capabilities.join(', ')}
                            </span>
                          </div>
                          <div className="mt-2 space-y-2">
                            {chain.map((modelId, index) => {
                              const model = snapshot.models.find(
                                (candidate) => candidate.id === modelId,
                              );
                              return (
                                <div
                                  key={`${modelId}-${index}`}
                                  className="flex items-center gap-2 rounded bg-neutral-50 p-2"
                                >
                                  <span className="min-w-0 flex-1 truncate">
                                    {index + 1}. {model?.displayName ?? modelId}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label={t('aiSettingsMoveUp')}
                                    disabled={index === 0}
                                    onClick={() => moveModel(definition.action, index, -1)}
                                  >
                                    ↑
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label={t('aiSettingsMoveDown')}
                                    disabled={index === chain.length - 1}
                                    onClick={() => moveModel(definition.action, index, 1)}
                                  >
                                    ↓
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setDraftRoutes((current) => ({
                                        ...current,
                                        [definition.action]: chain.filter(
                                          (_, itemIndex) => itemIndex !== index,
                                        ),
                                      }))
                                    }
                                  >
                                    ×
                                  </Button>
                                </div>
                              );
                            })}
                            <Select
                              className={FIELD}
                              defaultValue=""
                              onChange={(event) => {
                                const modelId = event.target.value;
                                event.target.value = '';
                                if (modelId && !chain.includes(modelId))
                                  setDraftRoutes((current) => ({
                                    ...current,
                                    [definition.action]: [...chain, modelId],
                                  }));
                              }}
                            >
                              <option value="">{t('aiSettingsAddRouteModel')}</option>
                              {candidates
                                .filter((model) => !chain.includes(model.id))
                                .map((model) => (
                                  <option key={model.id} value={model.id}>
                                    {model.displayName}
                                  </option>
                                ))}
                            </Select>
                          </div>
                        </div>
                      </section>
                    );
                  })}
                  <div className="space-y-2 border-t border-line pt-4">
                    {snapshot.pipelineSteps.map((step) => (
                      <label
                        key={step.step_id}
                        className="flex items-center justify-between gap-4 rounded border border-line p-3"
                      >
                        <span>
                          <strong>{step.label}</strong>
                          <span className="ml-2 text-xs text-ink-muted">
                            {step.required ? t('aiSettingsRequired') : step.bypass_kind}
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={draftSteps[step.step_id] ?? step.default_enabled}
                          disabled={step.required}
                          onChange={(event) =>
                            setDraftSteps((current) => ({
                              ...current,
                              [step.step_id]: event.target.checked,
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                  {routingDirty ? (
                    <p
                      role="status"
                      className="rounded-lg bg-warning-surface p-3 text-sm text-warning"
                    >
                      {t('aiSettingsUnsavedRouting')}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      loading={busy}
                      disabled={
                        !routingDirty ||
                        snapshot.actions.some(({ action }) =>
                          routeInvalid(action, draftRoutes[action] ?? []),
                        )
                      }
                      onClick={() =>
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
                    >
                      {t('aiSettingsSaveRouting')}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!routingDirty || busy}
                      onClick={() => {
                        const routes = routeDraft(snapshot);
                        for (const route of snapshot.routes)
                          routes[route.action] = [...route.model_ids];
                        setDraftRoutes(routes);
                        setDraftSteps(
                          Object.fromEntries(
                            snapshot.pipelineSteps.map((step) => [
                              step.step_id,
                              snapshot.stepPolicies.find(
                                (policy) => policy.step_id === step.step_id,
                              )?.enabled ?? step.default_enabled,
                            ]),
                          ),
                        );
                      }}
                    >
                      {t('aiSettingsDiscardRouting')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}
