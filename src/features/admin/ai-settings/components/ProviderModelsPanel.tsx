'use client';

import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import {
  deleteModel,
  discoverModels,
  patchModel,
  testModel,
} from '@/features/admin/ai-settings/api/ai-settings-api';
import type {
  CredentialViewModel,
  LlmCapability,
  ModelViewModel,
  ProviderViewModel,
} from '@/features/admin/ai-settings/types/ai-settings';

export type ModelFormState = {
  capabilities: LlmCapability[];
  displayName: string;
  enabled: boolean;
  inputPrice: string;
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
  mutate: (task: () => Promise<unknown>, success: string) => Promise<void>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  provider: ProviderViewModel;
  revision: number;
  setDiscoveredModels: Dispatch<SetStateAction<string[]>>;
  setError: Dispatch<SetStateAction<string>>;
  setModelForm: Dispatch<SetStateAction<ModelFormState>>;
  setNotice: Dispatch<SetStateAction<string>>;
};

const FIELD =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand-trust';
const CAPABILITIES = [
  'text',
  'structured_output',
  'streaming',
  'vision',
] as const satisfies readonly LlmCapability[];

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
  const firstKey = keys[0];

  return (
    <div className="space-y-4">
      <form className="space-y-3 rounded-lg border border-line p-3" onSubmit={onSubmit}>
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
          <Button type="submit" loading={busy} disabled={modelForm.capabilities.length === 0}>
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
        disabled={!firstKey}
        onClick={() => {
          if (!firstKey) return;
          void discoverModels(provider.id, firstKey.id)
            .then(({ data }) => {
              setDiscoveredModels(data.model_ids ?? []);
              setNotice(t('aiSettingsDiscoveryDone', { count: data.model_ids?.length ?? 0 }));
            })
            .catch((cause) =>
              setError(extractUnknownErrorMessage(cause, t('aiSettingsUnexpectedError'))),
            );
        }}
      >
        {t('aiSettingsDiscover')}
      </Button>

      {models.map((model) => (
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
                  {capability}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!firstKey}
              onClick={() => {
                if (firstKey) {
                  void mutate(
                    () => testModel(provider.id, model.id, firstKey.id),
                    t('aiSettingsProbePassed'),
                  ).catch(() => undefined);
                }
              }}
            >
              {t('aiSettingsTest')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void mutate(
                  () => patchModel(provider.id, model.id, { enabled: !model.enabled }, revision),
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
                  () => deleteModel(provider.id, model.id, revision),
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
  );
}
