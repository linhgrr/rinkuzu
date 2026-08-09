'use client';

import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
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
  form: ProviderFormState;
  onSelect: (provider: ProviderViewModel) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  selectedProviderId: string | null;
  setForm: Dispatch<SetStateAction<ProviderFormState>>;
  snapshot: AiSettingsViewModel;
};

const FIELD =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand-trust';

export function ProvidersPanel({
  busy,
  form,
  onSelect,
  onSubmit,
  selectedProviderId,
  setForm,
  snapshot,
}: ProvidersPanelProps) {
  const t = useTranslations('admin');

  return (
    <aside className="space-y-4 rounded-xl border border-line bg-white p-4">
      <h2 className="text-lg font-semibold">{t('aiSettingsProviders')}</h2>
      <div className="space-y-2">
        {snapshot.providers.map((provider) => {
          const keys = snapshot.credentials.filter((key) => key.providerId === provider.id);
          const models = snapshot.models.filter((model) => model.providerId === provider.id);
          return (
            <Button
              key={provider.id}
              variant="ghost"
              onClick={() => onSelect(provider)}
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

      <form className="space-y-2 border-t border-line pt-4" onSubmit={onSubmit}>
        <input
          className={FIELD}
          required
          placeholder={t('aiSettingsProviderName')}
          value={form.name}
          onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
        />
        <input
          className={FIELD}
          required
          type="url"
          placeholder="https://api.example.com/v1"
          value={form.baseUrl}
          onChange={(event) => setForm((value) => ({ ...value, baseUrl: event.target.value }))}
        />
        <input
          className={FIELD}
          required
          type="number"
          min="1"
          max="300"
          value={form.timeout}
          onChange={(event) => setForm((value) => ({ ...value, timeout: event.target.value }))}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm((value) => ({ ...value, enabled: event.target.checked }))}
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
  );
}
