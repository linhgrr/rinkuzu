'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Cpu,
  FlaskConical,
  KeyRound,
  Power,
  RefreshCw,
  Route,
  Server,
  Settings2,
  Trash2,
} from 'lucide-react';
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { TabBar } from '@/components/ui/TabBar';
import { Select } from '@/components/ui/Select';
import { ApiResponseError } from '@/lib/api/client';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';
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
import type {
  AiSettingsMutate,
  AiSettingsViewModel,
  RoutingMutationPolicy,
} from '@/features/admin/ai-settings/types/ai-settings';
import { AiSettingsConfirmDialog } from '@/features/admin/ai-settings/components/AiSettingsConfirmDialog';
import { AiSettingsIconButton } from '@/features/admin/ai-settings/components/AiSettingsIconButton';
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

type DetailTab = 'provider' | 'keys' | 'models';
type InitialTab = DetailTab | 'routing';
type WorkspaceView = 'providers' | 'routing';

const DETAIL_TABS: DetailTab[] = ['provider', 'keys', 'models'];

function routeDraft(snapshot: AiSettingsViewModel): DraftRoutes {
  return Object.fromEntries(snapshot.actions.map(({ action }) => [action, []])) as DraftRoutes;
}

export function AiSettingsClient({
  initialTab = 'provider',
  initialProviderId = null,
}: {
  initialTab?: InitialTab;
  initialProviderId?: string | null;
}) {
  const t = useTranslations('admin');
  const describeError = useAdminApiErrorMessage();
  const [snapshot, setSnapshot] = useState<AiSettingsViewModel | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(initialProviderId);
  const selectedProviderIdRef = useRef<string | null>(initialProviderId);
  const [workspace, setWorkspace] = useState<WorkspaceView>(
    initialTab === 'routing' ? 'routing' : 'providers',
  );
  const [tab, setTab] = useState<DetailTab>(initialTab === 'routing' ? 'provider' : initialTab);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  // The first load failed: nothing to show but ErrorState with Retry (RIN-1022).
  const [loadError, setLoadError] = useState<unknown>(null);
  const [providerCreateOpen, setProviderCreateOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<
    AiSettingsViewModel['providers'][number] | null
  >(null);
  const [probeKeyId, setProbeKeyId] = useState('');
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
    cacheHitPrice: '',
    outputPrice: '',
    enabled: true,
  });
  const [replacementSecrets, setReplacementSecrets] = useState<Record<string, string>>({});
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [draftRoutes, setDraftRoutes] = useState<DraftRoutes>({});
  const [draftSteps, setDraftSteps] = useState<DraftSteps>({});

  const load = useCallback(async (signal?: AbortSignal, preserveRoutingDraft = false) => {
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
    if (!preserveRoutingDraft) {
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
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(controller.signal)
        .catch((cause) => {
          if (!controller.signal.aborted) setLoadError(cause);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const selectedProvider = snapshot?.providers.find(
    (provider) => provider.id === selectedProviderId,
  );
  const providerKeys = useMemo(
    () => snapshot?.credentials.filter((key) => key.providerId === selectedProviderId) ?? [],
    [snapshot, selectedProviderId],
  );
  const usableProviderKeys = useMemo(
    () =>
      [...providerKeys]
        .filter((key) => key.enabled)
        .sort((left, right) => left.priority - right.priority),
    [providerKeys],
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

  const effectiveProbeKeyId = usableProviderKeys.some((key) => key.id === probeKeyId)
    ? probeKeyId
    : (usableProviderKeys[0]?.id ?? '');

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

  const mutate: AiSettingsMutate = async (
    task: () => Promise<unknown>,
    success: string,
    routingPolicy: RoutingMutationPolicy = 'discard',
  ) => {
    if (
      routingDirty &&
      routingPolicy === 'discard' &&
      !window.confirm(t('aiSettingsDiscardRoutingConfirm'))
    ) {
      return false;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
      await load(undefined, routingPolicy === 'preserve');
      setNotice(success);
      return true;
    } catch (cause) {
      if (cause instanceof ApiResponseError && [412, 428].includes(cause.status)) {
        await load();
        setError(t('aiSettingsStale'));
      } else {
        setError(describeError(cause, t('aiSettingsUnexpectedError')));
      }
      throw cause;
    } finally {
      setBusy(false);
    }
  };

  async function refreshSettings() {
    if (routingDirty && !window.confirm(t('aiSettingsDiscardRoutingConfirm'))) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await load();
    } catch (cause) {
      setError(describeError(cause, t('aiSettingsUnexpectedError')));
    } finally {
      setBusy(false);
    }
  }

  function discardRoutingDraft() {
    if (!snapshot) return;
    const routes = routeDraft(snapshot);
    for (const route of snapshot.routes) routes[route.action] = [...route.model_ids];
    setDraftRoutes(routes);
    setDraftSteps(
      Object.fromEntries(
        snapshot.pipelineSteps.map((step) => [
          step.step_id,
          snapshot.stepPolicies.find((policy) => policy.step_id === step.step_id)?.enabled ??
            step.default_enabled,
        ]),
      ),
    );
  }

  async function submitProvider(event: FormEvent) {
    event.preventDefault();
    if (!snapshot) return;
    try {
      const committed = await mutate(
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
      if (!committed) return;
      setProviderForm({ name: '', baseUrl: '', timeout: '60', enabled: true });
      setProviderCreateOpen(false);
    } catch {
      // mutate owns the visible error.
    }
  }

  async function submitKey(event: FormEvent) {
    event.preventDefault();
    if (!snapshot || !selectedProvider) return;
    try {
      const committed = await mutate(
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
      if (!committed) return;
      setKeyForm({ label: '', apiKey: '', priority: '100' });
    } catch {
      // Secret remains only long enough for the admin to retry this failed save.
    }
  }

  async function submitModel(event: FormEvent) {
    event.preventDefault();
    if (!snapshot || !selectedProvider) return;
    try {
      const committed = await mutate(
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
              input_cache_hit_price_usd_per_m_tokens: modelForm.cacheHitPrice || null,
              output_price_usd_per_m_tokens: modelForm.outputPrice || null,
            },
            snapshot.revision,
          ),
        t('aiSettingsSaved'),
      );
      if (!committed) return;
      setModelForm({
        displayName: '',
        upstreamName: '',
        capabilities: ['text'],
        timeout: '',
        inputPrice: '',
        cacheHitPrice: '',
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

  if (!snapshot && loadError) {
    return (
      <AdminPageShell>
        <AdminPageHeader title={t('aiSettingsTitle')} />
        <ErrorState
          error={loadError}
          onRetry={() =>
            load().then(
              () => setLoadError(null),
              (cause: unknown) => setLoadError(cause),
            )
          }
        />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <h1 className="sr-only">{t('aiSettingsTitle')}</h1>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-2">
        <nav className="flex flex-wrap gap-1" aria-label={t('aiSettingsWorkspaceNavigation')}>
          <Button
            size="sm"
            variant={workspace === 'providers' ? 'primary' : 'ghost'}
            aria-pressed={workspace === 'providers'}
            onClick={() => setWorkspace('providers')}
          >
            <Server className="size-4" aria-hidden="true" />
            {t('aiSettingsProviders')}
          </Button>
          <Button
            size="sm"
            variant={workspace === 'routing' ? 'primary' : 'ghost'}
            aria-pressed={workspace === 'routing'}
            onClick={() => {
              setWorkspace('routing');
              clearSecrets();
            }}
          >
            <Route className="size-4" aria-hidden="true" />
            {t('aiSettingsGlobalRouting')}
          </Button>
        </nav>
        <div className="flex items-center gap-2">
          {routingDirty ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              {t('aiSettingsUnsavedBadge')}
            </span>
          ) : null}
          <AiSettingsIconButton
            icon={RefreshCw}
            label={t('refresh')}
            variant="secondary"
            disabled={busy}
            onClick={() => void refreshSettings()}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-error-surface p-3 text-sm text-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mb-4 rounded-lg bg-success-surface p-3 text-sm text-green-800">
          {notice}
        </p>
      ) : null}

      {workspace === 'routing' && snapshot ? (
        <section className="min-w-0 rounded-xl border border-line bg-white p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-line pb-4">
            <div className="flex min-w-0 items-center gap-2">
              <Route className="size-5 shrink-0 text-accent" aria-hidden="true" />
              <h2 className="text-sm font-semibold">{t('aiSettingsGlobalRouting')}</h2>
            </div>
            <span className="text-xs text-ink-muted">
              {t('aiSettingsRevisionValue', { revision: snapshot.revision })}
            </span>
          </div>
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
                'commit',
              ).catch(() => undefined)
            }
            onDiscard={discardRoutingDraft}
          />
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          {snapshot ? (
            <ProvidersPanel
              busy={busy}
              creating={providerCreateOpen}
              form={providerForm}
              onSelect={selectProvider}
              onSubmit={submitProvider}
              selectedProviderId={selectedProviderId}
              setCreating={setProviderCreateOpen}
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
                    <h2 className="break-words text-lg font-semibold leading-snug">
                      {selectedProvider.name}
                    </h2>
                    <p className="mt-1 break-all text-xs text-neutral-500">
                      {selectedProvider.baseUrl}
                    </p>
                  </div>
                  <div className="flex max-w-full flex-wrap items-center gap-2">
                    {usableProviderKeys.length > 1 ? (
                      <Select
                        className="h-9 max-w-48 text-xs"
                        aria-label={t('aiSettingsProbeCredential')}
                        value={effectiveProbeKeyId}
                        onChange={(event) => setProbeKeyId(event.target.value)}
                      >
                        {usableProviderKeys.map((key) => (
                          <option key={key.id} value={key.id}>
                            {key.label}
                          </option>
                        ))}
                      </Select>
                    ) : null}
                    <AiSettingsIconButton
                      icon={FlaskConical}
                      label={t('aiSettingsTest')}
                      variant="secondary"
                      disabled={busy || !effectiveProbeKeyId}
                      onClick={() =>
                        void mutate(
                          () => testProvider(selectedProvider.id, { key_id: effectiveProbeKeyId }),
                          t('aiSettingsProbePassed'),
                          'preserve',
                        ).catch(() => undefined)
                      }
                    />
                    <AiSettingsIconButton
                      icon={Power}
                      label={selectedProvider.enabled ? t('disable') : t('enable')}
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
                    />
                    <AiSettingsIconButton
                      icon={Trash2}
                      label={t('delete')}
                      variant="destructive"
                      disabled={busy}
                      onClick={() => setProviderToDelete(selectedProvider)}
                    />
                  </div>
                </div>

                <TabBar
                  ariaLabel={t('aiSettingsProviderSections')}
                  className="my-5"
                  value={tab}
                  onChange={selectTab}
                  options={DETAIL_TABS.map((value) => {
                    const Icon =
                      value === 'provider' ? Settings2 : value === 'keys' ? KeyRound : Cpu;
                    return {
                      value,
                      label: t(`aiSettingsTab_${value}`),
                      icon: <Icon className="size-4" aria-hidden="true" />,
                      tabId: `ai-settings-tab-${value}`,
                      controlsId: 'ai-settings-tabpanel',
                    };
                  })}
                />

                <div
                  id="ai-settings-tabpanel"
                  role="tabpanel"
                  aria-labelledby={`ai-settings-tab-${tab}`}
                >
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
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <AiSettingsConfirmDialog
        open={providerToDelete !== null}
        busy={busy}
        title={t('aiSettingsDeleteProviderTitle')}
        description={t('aiSettingsDeleteProviderConfirm', {
          name: providerToDelete?.name ?? '',
        })}
        cancelLabel={t('cancel')}
        confirmLabel={t('delete')}
        onCancel={() => setProviderToDelete(null)}
        onConfirm={() => {
          if (!providerToDelete || !snapshot) return;
          void mutate(
            () => deleteProvider(providerToDelete.id, snapshot.revision),
            t('aiSettingsDeleted'),
          )
            .then((committed) => {
              if (committed) setProviderToDelete(null);
            })
            .catch(() => undefined);
        }}
      />
    </AdminPageShell>
  );
}
