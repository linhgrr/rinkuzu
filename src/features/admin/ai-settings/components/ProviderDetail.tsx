'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { patchProvider } from '@/features/admin/ai-settings/api/ai-settings-api';
import type { ProviderViewModel } from '@/features/admin/ai-settings/types/ai-settings';
import type { ProviderFormState } from '@/features/admin/ai-settings/components/ProvidersPanel';

type ProviderDetailProps = {
  busy: boolean;
  edit: ProviderFormState;
  mutate: (task: () => Promise<unknown>, success: string) => Promise<void>;
  provider: ProviderViewModel;
  revision: number;
  setEdit: Dispatch<SetStateAction<ProviderFormState>>;
};

const FIELD =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand-trust';

export function ProviderDetail({
  busy,
  edit,
  mutate,
  provider,
  revision,
  setEdit,
}: ProviderDetailProps) {
  const t = useTranslations('admin');

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void mutate(
          () =>
            patchProvider(
              provider.id,
              {
                name: edit.name.trim(),
                base_url: edit.baseUrl.trim(),
                timeout_sec: Number(edit.timeout),
                enabled: edit.enabled,
              },
              revision,
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
            value={edit.name}
            onChange={(event) => setEdit((value) => ({ ...value, name: event.target.value }))}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>{t('aiSettingsBaseUrl')}</span>
          <input
            className={FIELD}
            required
            type="url"
            value={edit.baseUrl}
            onChange={(event) => setEdit((value) => ({ ...value, baseUrl: event.target.value }))}
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
            value={edit.timeout}
            onChange={(event) => setEdit((value) => ({ ...value, timeout: event.target.value }))}
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={edit.enabled}
            onChange={(event) => setEdit((value) => ({ ...value, enabled: event.target.checked }))}
          />
          {t('aiSettingsProviderEnabled')}
        </label>
      </div>
      <p className="rounded-lg bg-warning-surface p-3 text-sm text-warning">
        {t('aiSettingsEgressWarning')}
      </p>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-neutral-500">{t('aiSettingsOrigin')}</dt>
          <dd className="mt-1 break-all">{provider.origin}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-neutral-500">{t('aiSettingsRevision')}</dt>
          <dd className="mt-1">{revision}</dd>
        </div>
      </dl>
      <Button type="submit" loading={busy}>
        {t('aiSettingsSaveProvider')}
      </Button>
    </form>
  );
}
