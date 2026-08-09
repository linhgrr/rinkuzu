'use client';

import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, CircleOff, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AiSettingsIconButton } from '@/features/admin/ai-settings/components/AiSettingsIconButton';
import type {
  AiSettingsViewModel,
  ProviderViewModel,
} from '@/features/admin/ai-settings/types/ai-settings';

export type ProviderFormState = {
  baseUrl: string;
  enabled: boolean;
  name: string;
  timeout: string;
};

type ProvidersPanelProps = {
  busy: boolean;
  creating: boolean;
  form: ProviderFormState;
  onSelect: (provider: ProviderViewModel) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  selectedProviderId: string | null;
  setCreating: Dispatch<SetStateAction<boolean>>;
  setForm: Dispatch<SetStateAction<ProviderFormState>>;
  snapshot: AiSettingsViewModel;
};

const FIELD =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1';

export function ProvidersPanel({
  busy,
  creating,
  form,
  onSelect,
  onSubmit,
  selectedProviderId,
  setCreating,
  setForm,
  snapshot,
}: ProvidersPanelProps) {
  const t = useTranslations('admin');

  return (
    <aside className="space-y-4 rounded-xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('aiSettingsProviders')}</h2>
        <AiSettingsIconButton
          icon={creating ? X : Plus}
          label={creating ? t('cancel') : t('aiSettingsAddProvider')}
          variant="secondary"
          disabled={busy}
          onClick={() => setCreating((value) => !value)}
        />
      </div>
      <div className="space-y-2">
        {snapshot.providers.map((provider) => {
          const keys = snapshot.credentials.filter((key) => key.providerId === provider.id);
          const models = snapshot.models.filter((model) => model.providerId === provider.id);
          return (
            <Button
              key={provider.id}
              variant="ghost"
              onClick={() => onSelect(provider)}
              className={`h-auto w-full min-w-0 justify-start overflow-hidden rounded-lg border p-4 text-left ${provider.id === selectedProviderId ? 'border-accent bg-accent-soft' : 'border-line'}`}
            >
              <span className="min-w-0 flex-1">
                <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 font-medium">
                  <span className="min-w-0 break-words leading-snug">{provider.name}</span>
                  <span
                    className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs ${provider.enabled ? 'bg-success-surface text-green-800' : 'bg-neutral-100 text-ink-muted'}`}
                  >
                    {provider.enabled ? (
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                    ) : (
                      <CircleOff className="size-3" aria-hidden="true" />
                    )}
                    {provider.enabled ? t('active') : t('inactive')}
                  </span>
                </span>
                <span className="mt-2 block break-all text-xs leading-relaxed text-ink-muted">
                  {provider.origin}
                </span>
                <span className="mt-2 block text-xs leading-relaxed text-ink-muted">
                  {t('aiSettingsProviderCounts', { keys: keys.length, models: models.length })}
                </span>
              </span>
            </Button>
          );
        })}
      </div>

      {creating ? (
        <form className="space-y-3 border-t border-line pt-4" onSubmit={onSubmit}>
          <label className="block space-y-1 text-xs font-medium text-ink-muted">
            <span>{t('aiSettingsProviderName')}</span>
            <input
              className={FIELD}
              required
              value={form.name}
              onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
            />
          </label>
          <label className="block space-y-1 text-xs font-medium text-ink-muted">
            <span>{t('aiSettingsBaseUrl')}</span>
            <input
              className={FIELD}
              required
              type="url"
              placeholder="https://api.example.com/v1"
              value={form.baseUrl}
              onChange={(event) => setForm((value) => ({ ...value, baseUrl: event.target.value }))}
            />
          </label>
          <label className="block space-y-1 text-xs font-medium text-ink-muted">
            <span>{t('aiSettingsTimeoutSeconds')}</span>
            <input
              className={FIELD}
              required
              type="number"
              min="1"
              max="300"
              value={form.timeout}
              onChange={(event) => setForm((value) => ({ ...value, timeout: event.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) =>
                setForm((value) => ({ ...value, enabled: event.target.checked }))
              }
            />
            {t('aiSettingsProviderEnabled')}
          </label>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-relaxed text-amber-800">
            {t('aiSettingsEgressWarning')}
          </p>
          <Button type="submit" className="w-full" loading={busy}>
            <Plus className="size-4" aria-hidden="true" />
            {t('aiSettingsAddProvider')}
          </Button>
        </form>
      ) : null}
    </aside>
  );
}
