'use client';

import { type Dispatch, type FormEventHandler, type SetStateAction, useState } from 'react';
import { FlaskConical, KeyRound, Plus, Power, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import {
  deleteCredential,
  patchCredential,
  replaceCredentialSecret,
  testCredential,
} from '@/features/admin/ai-settings/api/ai-settings-api';
import { AiSettingsConfirmDialog } from '@/features/admin/ai-settings/components/AiSettingsConfirmDialog';
import { AiSettingsIconButton } from '@/features/admin/ai-settings/components/AiSettingsIconButton';
import type {
  AiSettingsMutate,
  AiSettingsViewModel,
  CredentialViewModel,
  ProviderViewModel,
} from '@/features/admin/ai-settings/types/ai-settings';

export type KeyFormState = {
  apiKey: string;
  label: string;
  priority: string;
};

type KeyEdit = { label: string; priority: string };
type PendingConfirmation = { kind: 'delete' | 'replace'; key: CredentialViewModel };

type ProviderKeysPanelProps = {
  busy: boolean;
  keyForm: KeyFormState;
  keys: CredentialViewModel[];
  mutate: AiSettingsMutate;
  onSubmit: FormEventHandler<HTMLFormElement>;
  provider: ProviderViewModel;
  replacementSecrets: Record<string, string>;
  revision: AiSettingsViewModel['revision'];
  setKeyForm: Dispatch<SetStateAction<KeyFormState>>;
  setReplacementSecrets: Dispatch<SetStateAction<Record<string, string>>>;
};

const FIELD =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1';

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
  const [edits, setEdits] = useState<Record<string, KeyEdit>>({});
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{t('aiSettingsKeyPriorityHelp')}</p>
      <form className="rounded-xl border border-line p-4" onSubmit={onSubmit}>
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]">
          <label className="space-y-1 text-xs font-medium text-ink-muted">
            <span>{t('aiSettingsKeyLabel')}</span>
            <input
              className={FIELD}
              required
              value={keyForm.label}
              onChange={(event) => setKeyForm((value) => ({ ...value, label: event.target.value }))}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink-muted">
            <span>{t('aiSettingsApiKey')}</span>
            <input
              className={FIELD}
              required
              type="password"
              autoComplete="new-password"
              value={keyForm.apiKey}
              onChange={(event) =>
                setKeyForm((value) => ({ ...value, apiKey: event.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink-muted">
            <span>{t('aiSettingsKeyPriority')}</span>
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
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="submit" loading={busy}>
            <Plus className="size-4" aria-hidden="true" />
            {t('aiSettingsAddKey')}
          </Button>
        </div>
      </form>

      {keys.map((key) => {
        const edit = edits[key.id] ?? { label: key.label, priority: String(key.priority) };
        const priority = Number(edit.priority);
        const valid =
          edit.label.trim().length > 0 &&
          Number.isInteger(priority) &&
          priority >= 0 &&
          priority <= 10000;
        const changed = edit.label.trim() !== key.label || priority !== key.priority;

        return (
          <article
            key={key.id}
            aria-label={key.label}
            className="min-w-0 overflow-hidden rounded-xl border border-line p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-72">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
                  <label className="space-y-1 text-xs font-medium text-ink-muted">
                    <span>{t('aiSettingsKeyLabel')}</span>
                    <input
                      className={FIELD}
                      value={edit.label}
                      aria-invalid={!edit.label.trim()}
                      onChange={(event) =>
                        setEdits((value) => ({
                          ...value,
                          [key.id]: { ...edit, label: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-ink-muted">
                    <span>{t('aiSettingsKeyPriority')}</span>
                    <input
                      className={FIELD}
                      type="number"
                      min="0"
                      max="10000"
                      value={edit.priority}
                      aria-invalid={!Number.isInteger(priority) || priority < 0 || priority > 10000}
                      onChange={(event) =>
                        setEdits((value) => ({
                          ...value,
                          [key.id]: { ...edit, priority: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <AiSettingsIconButton
                    icon={Save}
                    label={t('aiSettingsSaveChanges')}
                    variant="secondary"
                    disabled={busy || !changed || !valid}
                    onClick={() =>
                      void mutate(
                        () =>
                          patchCredential(
                            provider.id,
                            key.id,
                            { label: edit.label.trim(), priority },
                            revision,
                          ),
                        t('aiSettingsSaved'),
                      ).catch(() => undefined)
                    }
                  />
                </div>
                <p className="mt-2 flex min-w-0 items-center gap-2">
                  <KeyRound className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span className="break-all font-mono text-sm">{key.maskedKey}</span>
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {t('aiSettingsKeyMeta', {
                    priority: key.priority,
                    health: t(`aiSettingsHealth_${key.healthStatus}`),
                  })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AiSettingsIconButton
                  icon={FlaskConical}
                  label={t('aiSettingsTest')}
                  variant="secondary"
                  disabled={busy || !key.enabled}
                  onClick={() =>
                    void mutate(
                      () => testCredential(provider.id, key.id),
                      t('aiSettingsProbePassed'),
                      'preserve',
                    ).catch(() => undefined)
                  }
                />
                <AiSettingsIconButton
                  icon={Power}
                  label={key.enabled ? t('disable') : t('enable')}
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      () =>
                        patchCredential(provider.id, key.id, { enabled: !key.enabled }, revision),
                      t('aiSettingsSaved'),
                    ).catch(() => undefined)
                  }
                />
                <AiSettingsIconButton
                  icon={Trash2}
                  label={t('delete')}
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setPendingConfirmation({ kind: 'delete', key })}
                />
              </div>
            </div>

            <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
              <label className="min-w-0 flex-1 space-y-1 text-xs font-medium text-ink-muted">
                <span>{t('aiSettingsReplacementKey')}</span>
                <input
                  className={FIELD}
                  type="password"
                  autoComplete="new-password"
                  value={replacementSecrets[key.id] ?? ''}
                  onChange={(event) =>
                    setReplacementSecrets((value) => ({
                      ...value,
                      [key.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="flex items-end">
                <AiSettingsIconButton
                  icon={RefreshCw}
                  label={t('aiSettingsReplace')}
                  variant="secondary"
                  disabled={busy || !replacementSecrets[key.id]}
                  onClick={() => setPendingConfirmation({ kind: 'replace', key })}
                />
              </div>
            </div>
          </article>
        );
      })}

      <AiSettingsConfirmDialog
        open={pendingConfirmation !== null}
        busy={busy}
        title={
          pendingConfirmation?.kind === 'replace'
            ? t('aiSettingsReplaceKeyTitle')
            : t('aiSettingsDeleteKeyTitle')
        }
        description={
          pendingConfirmation?.kind === 'replace'
            ? t('aiSettingsReplaceKeyConfirm', { label: pendingConfirmation.key.label })
            : t('aiSettingsDeleteKeyConfirm', { label: pendingConfirmation?.key.label ?? '' })
        }
        cancelLabel={t('cancel')}
        confirmLabel={
          pendingConfirmation?.kind === 'replace' ? t('aiSettingsReplace') : t('delete')
        }
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={() => {
          if (!pendingConfirmation) return;
          const { key, kind } = pendingConfirmation;
          const secret = replacementSecrets[key.id];
          const task =
            kind === 'delete'
              ? () => deleteCredential(provider.id, key.id, revision)
              : () => replaceCredentialSecret(provider.id, key.id, secret ?? '', revision);
          void mutate(task, kind === 'delete' ? t('aiSettingsDeleted') : t('aiSettingsSaved'))
            .then((committed) => {
              if (!committed) return;
              if (kind === 'replace') {
                setReplacementSecrets((value) => ({ ...value, [key.id]: '' }));
              }
              setPendingConfirmation(null);
            })
            .catch(() => undefined);
        }}
      />
    </div>
  );
}
