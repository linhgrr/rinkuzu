'use client';

import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import {
  deleteCredential,
  patchCredential,
  replaceCredentialSecret,
  testCredential,
} from '@/features/admin/ai-settings/api/ai-settings-api';
import type {
  AiSettingsViewModel,
  CredentialViewModel,
  ProviderViewModel,
} from '@/features/admin/ai-settings/types/ai-settings';

export type KeyFormState = {
  apiKey: string;
  label: string;
  priority: string;
};

type Mutate = (task: () => Promise<unknown>, success: string) => Promise<void>;

type ProviderKeysPanelProps = {
  busy: boolean;
  keyForm: KeyFormState;
  keys: CredentialViewModel[];
  mutate: Mutate;
  onSubmit: FormEventHandler<HTMLFormElement>;
  provider: ProviderViewModel;
  replacementSecrets: Record<string, string>;
  revision: AiSettingsViewModel['revision'];
  setKeyForm: Dispatch<SetStateAction<KeyFormState>>;
  setReplacementSecrets: Dispatch<SetStateAction<Record<string, string>>>;
};

const FIELD =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand-trust';

export function ProviderKeysPanel({
  busy,
  keyForm,
  keys,
  mutate,
  onSubmit,
  provider,
  replacementSecrets,
  revision,
  setKeyForm,
  setReplacementSecrets,
}: ProviderKeysPanelProps) {
  const t = useTranslations('admin');

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{t('aiSettingsKeyPriorityHelp')}</p>
      <form
        className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_100px_auto]"
        onSubmit={onSubmit}
      >
        <input
          className={FIELD}
          required
          placeholder={t('aiSettingsKeyLabel')}
          value={keyForm.label}
          onChange={(event) => setKeyForm((value) => ({ ...value, label: event.target.value }))}
        />
        <input
          className={FIELD}
          required
          type="password"
          autoComplete="new-password"
          placeholder={t('aiSettingsApiKey')}
          value={keyForm.apiKey}
          onChange={(event) => setKeyForm((value) => ({ ...value, apiKey: event.target.value }))}
        />
        <input
          className={FIELD}
          required
          type="number"
          min="0"
          max="10000"
          value={keyForm.priority}
          onChange={(event) => setKeyForm((value) => ({ ...value, priority: event.target.value }))}
        />
        <Button type="submit" loading={busy}>
          {t('aiSettingsAddKey')}
        </Button>
      </form>

      {keys.map((key) => (
        <div key={key.id} className="min-w-0 overflow-hidden rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 basis-64">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
                <input
                  className={FIELD}
                  aria-label={t('aiSettingsKeyLabel')}
                  defaultValue={key.label}
                  onBlur={(event) => {
                    const label = event.target.value.trim();
                    if (label && label !== key.label) {
                      void mutate(
                        () => patchCredential(provider.id, key.id, { label }, revision),
                        t('aiSettingsSaved'),
                      ).catch(() => undefined);
                    }
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
                    if (Number.isInteger(priority) && priority !== key.priority) {
                      void mutate(
                        () => patchCredential(provider.id, key.id, { priority }, revision),
                        t('aiSettingsSaved'),
                      ).catch(() => undefined);
                    }
                  }}
                />
              </div>
              <p className="mt-1">
                <span className="break-all font-mono text-sm">{key.maskedKey}</span>
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
                    () => testCredential(provider.id, key.id),
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
                    () => patchCredential(provider.id, key.id, { enabled: !key.enabled }, revision),
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
                    () => deleteCredential(provider.id, key.id, revision),
                    t('aiSettingsDeleted'),
                  ).catch(() => undefined)
                }
              >
                {t('delete')}
              </Button>
            </div>
          </div>
          <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
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
                  () => replaceCredentialSecret(provider.id, key.id, secret, revision),
                  t('aiSettingsSaved'),
                )
                  .then(() => setReplacementSecrets((value) => ({ ...value, [key.id]: '' })))
                  .catch(() => undefined);
              }}
            >
              {t('aiSettingsReplace')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
