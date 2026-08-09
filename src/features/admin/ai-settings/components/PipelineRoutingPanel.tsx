'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type {
  AiSettingsViewModel,
  LlmAction,
  LlmCapability,
} from '@/features/admin/ai-settings/types/ai-settings';

export type DraftRoutes = Record<string, string[]>;
export type DraftSteps = Record<string, boolean>;

type PipelineRoutingPanelProps = {
  busy: boolean;
  draftRoutes: DraftRoutes;
  draftSteps: DraftSteps;
  routingDirty: boolean;
  setDraftRoutes: Dispatch<SetStateAction<DraftRoutes>>;
  setDraftSteps: Dispatch<SetStateAction<DraftSteps>>;
  snapshot: AiSettingsViewModel;
  onDiscard: () => void;
  onSave: () => void;
};

const FIELD =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand-trust';

function routeInvalid(
  snapshot: AiSettingsViewModel,
  action: LlmAction,
  modelIds: string[],
): boolean {
  if (modelIds.length === 0 || new Set(modelIds).size !== modelIds.length) return true;

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

export function PipelineRoutingPanel({
  busy,
  draftRoutes,
  draftSteps,
  routingDirty,
  setDraftRoutes,
  setDraftSteps,
  snapshot,
  onDiscard,
  onSave,
}: PipelineRoutingPanelProps) {
  const t = useTranslations('admin');

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

  return (
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
              (credential) => credential.providerId === model.providerId && credential.enabled,
            ) &&
            definition.required_capabilities.every((capability: LlmCapability) =>
              model.capabilities.includes(capability),
            )
          );
        });
        const invalid = routeInvalid(snapshot, definition.action, chain);
        const isFirstInGroup =
          snapshot.actions.findIndex((item) => item.group === definition.group) ===
          snapshot.actions.indexOf(definition);

        return (
          <section key={definition.action} className="min-w-0 space-y-2">
            {isFirstInGroup ? (
              <h3 className="text-base font-semibold capitalize">
                {definition.group.replaceAll('_', ' ')}
              </h3>
            ) : null}
            <div
              className={`min-w-0 overflow-hidden rounded-xl border p-4 sm:p-5 ${invalid ? 'border-error' : 'border-line'}`}
            >
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <span className="min-w-0">
                  <strong className="block break-words leading-snug">{definition.label}</strong>
                  <span className="mt-1 block break-words text-xs leading-relaxed text-neutral-500">
                    {definition.description}
                  </span>
                </span>
                <span className="flex max-w-full flex-wrap gap-1.5 sm:max-w-64 sm:justify-end">
                  {definition.required_capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="max-w-full break-all rounded-full bg-neutral-100 px-2 py-1 text-[11px] leading-tight text-neutral-600"
                    >
                      {capability}
                    </span>
                  ))}
                </span>
              </div>
              <div className="mt-4 min-w-0 space-y-3">
                {chain.map((modelId, index) => {
                  const model = snapshot.models.find((candidate) => candidate.id === modelId);
                  return (
                    <div
                      key={`${modelId}-${index}`}
                      className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-neutral-50 p-3"
                    >
                      <span className="min-w-0 flex-1 basis-48 break-words leading-snug">
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
                    if (modelId && !chain.includes(modelId)) {
                      setDraftRoutes((current) => ({
                        ...current,
                        [definition.action]: [...chain, modelId],
                      }));
                    }
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
            className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-xl border border-line p-4"
          >
            <span className="min-w-0 flex-1 basis-64">
              <strong className="break-words">{step.label}</strong>
              <span className="ml-2 break-all text-xs text-ink-muted">
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
        <p role="status" className="rounded-lg bg-warning-surface p-3 text-sm text-warning">
          {t('aiSettingsUnsavedRouting')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          loading={busy}
          disabled={
            !routingDirty ||
            snapshot.actions.some(({ action }) =>
              routeInvalid(snapshot, action, draftRoutes[action] ?? []),
            )
          }
          onClick={onSave}
        >
          {t('aiSettingsSaveRouting')}
        </Button>
        <Button variant="secondary" disabled={!routingDirty || busy} onClick={onDiscard}>
          {t('aiSettingsDiscardRouting')}
        </Button>
      </div>
    </div>
  );
}
