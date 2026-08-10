'use client';

import {
  type Dispatch,
  type FormEventHandler,
  type SetStateAction,
  useMemo,
  useState,
} from 'react';
import { useTranslations } from 'next-intl';
import { CircleDollarSign, FlaskConical, Plus, Power, Save, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import {
  deleteModel,
  discoverModels,
  patchModel,
  testModel,
} from '@/features/admin/ai-settings/api/ai-settings-api';
import type {
  AiSettingsMutate,
  CredentialViewModel,
  LlmCapability,
  ModelViewModel,
  ProviderViewModel,
} from '@/features/admin/ai-settings/types/ai-settings';
import { AiSettingsConfirmDialog } from '@/features/admin/ai-settings/components/AiSettingsConfirmDialog';
import { AiSettingsIconButton } from '@/features/admin/ai-settings/components/AiSettingsIconButton';

export type ModelFormState = {
  capabilities: LlmCapability[];
  displayName: string;
  enabled: boolean;
  inputPrice: string;
  cacheHitPrice: string;
  outputPrice: string;
  timeout: string;
  upstreamName: string;
};

type ProviderModelsPanelProps = {
  busy: boolean;
  discoveredModels: string[];
  keys: CredentialViewModel[];
  modelForm: ModelFormState;
  models: ModelViewModel[];
  mutate: AiSettingsMutate;
  onSubmit: FormEventHandler<HTMLFormElement>;
  provider: ProviderViewModel;
  revision: number;
  setDiscoveredModels: Dispatch<SetStateAction<string[]>>;
  setError: Dispatch<SetStateAction<string>>;
  setModelForm: Dispatch<SetStateAction<ModelFormState>>;
  setNotice: Dispatch<SetStateAction<string>>;
};

const FIELD =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1';
const CAPABILITIES = [
  'text',
  'structured_output',
  'streaming',
  'vision',
] as const satisfies readonly LlmCapability[];

function hasCompletePricing(model: ModelViewModel): boolean {
  return Boolean(model.inputPrice?.trim() && model.outputPrice?.trim());
}

function pricingValid(input: string, cacheHit: string, output: string): boolean {
  const hasInput = Boolean(input.trim());
  const hasOutput = Boolean(output.trim());
  if (hasInput !== hasOutput) return false;
  if (!cacheHit.trim()) return true;
  if (!hasInput) return false;
  return Number(cacheHit) <= Number(input);
}

export function ProviderModelsPanel({
  busy,
  discoveredModels,
  keys,
  modelForm,
  models,
  mutate,
  onSubmit,
  provider,
  revision,
  setDiscoveredModels,
  setError,
  setModelForm,
  setNotice,
}: ProviderModelsPanelProps) {
  const t = useTranslations('admin');
  const usableKeys = useMemo(
    () =>
      [...keys].filter((key) => key.enabled).sort((left, right) => left.priority - right.priority),
    [keys],
  );
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<ModelViewModel | null>(null);
  const [pricingModelId, setPricingModelId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState({ input: '', cacheHit: '', output: '' });

  const createPricingValid = pricingValid(
    modelForm.inputPrice,
    modelForm.cacheHitPrice,
    modelForm.outputPrice,
  );
  const editPricingValid = pricingValid(priceDraft.input, priceDraft.cacheHit, priceDraft.output);

  const effectiveKeyId = usableKeys.some((key) => key.id === selectedKeyId)
    ? selectedKeyId
    : (usableKeys[0]?.id ?? '');

  return (
    <div className="space-y-4">
      <form className="min-w-0 space-y-4 rounded-xl border border-line p-4" onSubmit={onSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-ink-muted">
            <span>{t('aiSettingsModelLabel')}</span>
            <input
              className={FIELD}
              required
              value={modelForm.displayName}
              onChange={(event) =>
                setModelForm((value) => ({ ...value, displayName: event.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink-muted">
            <span>{t('aiSettingsUpstreamModel')}</span>
            <input
              className={FIELD}
              required
              list="discovered-models"
              value={modelForm.upstreamName}
              onChange={(event) =>
                setModelForm((value) => ({ ...value, upstreamName: event.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink-muted md:col-span-2 lg:col-span-1">
            <span>{t('aiSettingsModelTimeout')}</span>
            <input
              className={FIELD}
              type="number"
              min="1"
              max="300"
              value={modelForm.timeout}
              onChange={(event) =>
                setModelForm((value) => ({ ...value, timeout: event.target.value }))
              }
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-3 md:col-span-2">
            <label className="space-y-1 text-xs font-medium text-ink-muted">
              <span>{t('aiSettingsInputMissPrice')}</span>
              <input
                className={FIELD}
                type="number"
                min="0"
                step="any"
                placeholder="0.14"
                aria-invalid={!createPricingValid}
                aria-describedby="ai-settings-create-pricing-help"
                value={modelForm.inputPrice}
                onChange={(event) =>
                  setModelForm((value) => ({ ...value, inputPrice: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-ink-muted">
              <span>{t('aiSettingsCacheHitPrice')}</span>
              <input
                className={FIELD}
                type="number"
                min="0"
                step="any"
                placeholder="0.0028"
                aria-invalid={!createPricingValid}
                aria-describedby="ai-settings-create-pricing-help"
                value={modelForm.cacheHitPrice}
                onChange={(event) =>
                  setModelForm((value) => ({ ...value, cacheHitPrice: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-ink-muted">
              <span>{t('aiSettingsOutputPrice')}</span>
              <input
                className={FIELD}
                type="number"
                min="0"
                step="any"
                placeholder="0.28"
                aria-invalid={!createPricingValid}
                aria-describedby="ai-settings-create-pricing-help"
                value={modelForm.outputPrice}
                onChange={(event) =>
                  setModelForm((value) => ({ ...value, outputPrice: event.target.value }))
                }
              />
            </label>
            <p
              id="ai-settings-create-pricing-help"
              className={`text-xs sm:col-span-3 ${
                createPricingValid ? 'text-neutral-500' : 'text-error'
              }`}
            >
              {createPricingValid ? t('aiSettingsPricingHint') : t('aiSettingsCachePricingInvalid')}
            </p>
          </div>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t('aiSettingsCapabilities')}</legend>
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
                {t(`aiSettingsCapability_${capability}`)}
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
            disabled={modelForm.capabilities.length === 0 || !createPricingValid}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('aiSettingsAddModel')}
          </Button>
        </div>
      </form>

      <datalist id="discovered-models">
        {discoveredModels.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center gap-2">
        {usableKeys.length > 1 ? (
          <Select
            className="h-10 max-w-56 text-sm"
            aria-label={t('aiSettingsProbeCredential')}
            value={effectiveKeyId}
            onChange={(event) => setSelectedKeyId(event.target.value)}
          >
            {usableKeys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.label}
              </option>
            ))}
          </Select>
        ) : null}
        <Button
          variant="secondary"
          loading={discovering}
          disabled={busy || discovering || !effectiveKeyId}
          onClick={() => {
            if (!effectiveKeyId) return;
            setDiscovering(true);
            setError('');
            void discoverModels(provider.id, effectiveKeyId)
              .then(({ data }) => {
                setDiscoveredModels(data.model_ids ?? []);
                setNotice(t('aiSettingsDiscoveryDone', { count: data.model_ids?.length ?? 0 }));
              })
              .catch((cause) =>
                setError(extractUnknownErrorMessage(cause, t('aiSettingsUnexpectedError'))),
              )
              .finally(() => setDiscovering(false));
          }}
        >
          <Search className="size-4" aria-hidden="true" />
          {t('aiSettingsDiscover')}
        </Button>
      </div>

      {models.map((model) => (
        <article
          key={model.id}
          aria-label={model.displayName}
          className="flex min-w-0 flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl border border-line p-4"
        >
          <div className="min-w-0 flex-1 basis-64">
            <strong className="block break-words leading-snug">{model.displayName}</strong>
            <p className="break-all font-mono text-xs leading-relaxed text-neutral-500">
              {model.upstreamName}
            </p>
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
                      (model.capabilities.length === 1 && model.capabilities[0] === capability)
                    }
                    onChange={(event) => {
                      const capabilities = event.target.checked
                        ? [...model.capabilities, capability]
                        : model.capabilities.filter((item) => item !== capability);
                      void mutate(
                        () => patchModel(provider.id, model.id, { capabilities }, revision),
                        t('aiSettingsSaved'),
                      ).catch(() => undefined);
                    }}
                  />
                  {t(`aiSettingsCapability_${capability}`)}
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {hasCompletePricing(model) ? (
                <>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700">
                    {t('aiSettingsInputMissPriceShort', { price: model.inputPrice ?? '' })}
                  </span>
                  {model.cacheHitPrice ? (
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-800">
                      {t('aiSettingsCacheHitPriceShort', { price: model.cacheHitPrice })}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700">
                    {t('aiSettingsOutputPriceShort', { price: model.outputPrice ?? '' })}
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">
                  <CircleDollarSign className="size-3.5" aria-hidden="true" />
                  {t('aiSettingsPricingMissing')}
                </span>
              )}
            </div>
          </div>
          <div className="flex max-w-full flex-wrap gap-2">
            <AiSettingsIconButton
              icon={CircleDollarSign}
              label={t('aiSettingsEditPricing')}
              variant="secondary"
              disabled={busy}
              onClick={() => {
                if (pricingModelId === model.id) {
                  setPricingModelId(null);
                  return;
                }
                setPricingModelId(model.id);
                setPriceDraft({
                  input: model.inputPrice ?? '',
                  cacheHit: model.cacheHitPrice ?? '',
                  output: model.outputPrice ?? '',
                });
              }}
            />
            <AiSettingsIconButton
              icon={FlaskConical}
              label={t('aiSettingsTest')}
              variant="secondary"
              disabled={busy || !effectiveKeyId}
              onClick={() => {
                if (effectiveKeyId) {
                  void mutate(
                    () => testModel(provider.id, model.id, effectiveKeyId),
                    t('aiSettingsProbePassed'),
                    'preserve',
                  ).catch(() => undefined);
                }
              }}
            />
            <AiSettingsIconButton
              icon={Power}
              label={model.enabled ? t('disable') : t('enable')}
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void mutate(
                  () => patchModel(provider.id, model.id, { enabled: !model.enabled }, revision),
                  t('aiSettingsSaved'),
                ).catch(() => undefined)
              }
            />
            <AiSettingsIconButton
              icon={Trash2}
              label={t('delete')}
              variant="destructive"
              disabled={busy}
              onClick={() => setModelToDelete(model)}
            />
          </div>
          {pricingModelId === model.id ? (
            <form
              className="grid basis-full gap-3 border-t border-line pt-4 sm:grid-cols-3"
              aria-label={t('aiSettingsPricingEditor', { name: model.displayName })}
              action={() => {
                if (!editPricingValid) return;
                void mutate(
                  () =>
                    patchModel(
                      provider.id,
                      model.id,
                      {
                        input_price_usd_per_m_tokens: priceDraft.input.trim() || null,
                        input_cache_hit_price_usd_per_m_tokens: priceDraft.cacheHit.trim() || null,
                        output_price_usd_per_m_tokens: priceDraft.output.trim() || null,
                      },
                      revision,
                    ),
                  t('aiSettingsPricingSaved'),
                  'preserve',
                )
                  .then((committed) => {
                    if (committed) setPricingModelId(null);
                  })
                  .catch(() => undefined);
              }}
            >
              <label className="space-y-1 text-xs font-medium text-ink-muted">
                <span>{t('aiSettingsInputMissPrice')}</span>
                <input
                  className={FIELD}
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.14"
                  aria-invalid={!editPricingValid}
                  aria-describedby={`ai-settings-pricing-help-${model.id}`}
                  value={priceDraft.input}
                  onChange={(event) =>
                    setPriceDraft((value) => ({ ...value, input: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-ink-muted">
                <span>{t('aiSettingsCacheHitPrice')}</span>
                <input
                  className={FIELD}
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.0028"
                  aria-invalid={!editPricingValid}
                  aria-describedby={`ai-settings-pricing-help-${model.id}`}
                  value={priceDraft.cacheHit}
                  onChange={(event) =>
                    setPriceDraft((value) => ({ ...value, cacheHit: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-ink-muted">
                <span>{t('aiSettingsOutputPrice')}</span>
                <input
                  className={FIELD}
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.28"
                  aria-invalid={!editPricingValid}
                  aria-describedby={`ai-settings-pricing-help-${model.id}`}
                  value={priceDraft.output}
                  onChange={(event) =>
                    setPriceDraft((value) => ({ ...value, output: event.target.value }))
                  }
                />
              </label>
              <p
                id={`ai-settings-pricing-help-${model.id}`}
                className={`text-xs sm:col-span-3 ${
                  editPricingValid ? 'text-neutral-500' : 'text-error'
                }`}
              >
                {editPricingValid ? t('aiSettingsPricingHint') : t('aiSettingsCachePricingInvalid')}
              </p>
              <div className="flex flex-wrap gap-2 sm:col-span-3">
                <Button type="submit" size="sm" loading={busy} disabled={!editPricingValid}>
                  <Save className="size-4" aria-hidden="true" />
                  {t('aiSettingsSavePricing')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setPricingModelId(null)}
                >
                  <X className="size-4" aria-hidden="true" />
                  {t('cancel')}
                </Button>
              </div>
            </form>
          ) : null}
        </article>
      ))}

      <AiSettingsConfirmDialog
        open={modelToDelete !== null}
        busy={busy}
        title={t('aiSettingsDeleteModelTitle')}
        description={t('aiSettingsDeleteModelConfirm', { name: modelToDelete?.displayName ?? '' })}
        cancelLabel={t('cancel')}
        confirmLabel={t('delete')}
        onCancel={() => setModelToDelete(null)}
        onConfirm={() => {
          if (!modelToDelete) return;
          void mutate(
            () => deleteModel(provider.id, modelToDelete.id, revision),
            t('aiSettingsDeleted'),
          )
            .then((committed) => {
              if (committed) setModelToDelete(null);
            })
            .catch(() => undefined);
        }}
      />
    </div>
  );
}
