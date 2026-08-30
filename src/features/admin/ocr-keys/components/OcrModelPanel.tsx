'use client';

import { FormEvent, useEffect, useEffectEvent, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { HiOutlineChip, HiOutlineDatabase, HiOutlineSave } from 'react-icons/hi';
import { Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  fetchAdminOcrModelSettings,
  updateAdminOcrModel,
} from '@/features/admin/ocr-keys/api/admin-ocr-keys-api';
import type { AdminOcrModelSettingsViewModel } from '@/features/admin/ocr-keys/types/admin-ocr-keys-view-model';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { DEFAULT_DATE_TIME_ZONE } from '@/lib/formatters';

const ocrModelDateTimeOptions: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: DEFAULT_DATE_TIME_ZONE,
};
const ocrModelDateFormatterEn = new Intl.DateTimeFormat('en', ocrModelDateTimeOptions);
const ocrModelDateFormatterVi = new Intl.DateTimeFormat('vi', ocrModelDateTimeOptions);

export function OcrModelPanel() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [settings, setSettings] = useState<AdminOcrModelSettingsViewModel | null>(null);
  const [modelName, setModelName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadSettings(signal?: AbortSignal) {
    setLoading(true);
    setError('');
    try {
      const value = await fetchAdminOcrModelSettings(signal);
      setSettings(value);
      setModelName(value.modelName);
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(extractUnknownErrorMessage(loadError, t('ocrModelLoadError')));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  const onInitialLoad = useEffectEvent((signal: AbortSignal) => {
    void loadSettings(signal);
  });

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => onInitialLoad(controller.signal), 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = modelName.trim();
    if (!normalizedName) {
      setError(t('ocrModelRequired'));
      setSuccess('');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const value = await updateAdminOcrModel(normalizedName);
      setSettings(value);
      setModelName(value.modelName);
      setSuccess(t('ocrModelSaved'));
    } catch (saveError) {
      setError(extractUnknownErrorMessage(saveError, t('ocrModelSaveError')));
    } finally {
      setSaving(false);
    }
  }

  const updatedAt = settings?.updatedAt
    ? (locale.startsWith('vi') ? ocrModelDateFormatterVi : ocrModelDateFormatterEn).format(
        new Date(settings.updatedAt),
      )
    : t('ocrModelNotOverridden');

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div id="ocr-models-panel" role="tabpanel" aria-labelledby="ocr-models-tab">
      {error ? (
        <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div className="mb-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-line-blue/30 bg-white p-5 md:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-ink/55">{t('ocrModelActive')}</div>
              <div className="mt-2 break-all font-mono text-xl font-semibold text-ink">
                {settings?.modelName || '—'}
              </div>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <HiOutlineChip className="size-6" />
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-line-blue/30 bg-white p-5">
          <div className="text-sm font-medium text-ink/55">{t('ocrModelSource')}</div>
          <div className="mt-3">
            <Badge variant={settings?.source === 'database' ? 'success' : 'warning'}>
              {settings?.source === 'database'
                ? t('ocrModelSourceDatabase')
                : t('ocrModelSourceEnvironment')}
            </Badge>
          </div>
          <div className="mt-3 text-xs text-ink/50">{updatedAt}</div>
        </div>
      </section>

      <section className="rounded-lg border border-line-blue/30 bg-white">
        <div className="border-b border-line-blue/25 px-5 py-4">
          <h2 className="text-lg font-semibold text-ink">{t('ocrModelConfigureTitle')}</h2>
          <p className="mt-1 text-sm text-ink/55">{t('ocrModelConfigureDescription')}</p>
        </div>
        <form onSubmit={handleSave} className="space-y-5 p-5">
          <label className="block max-w-2xl">
            <span className="mb-2 block text-sm font-semibold text-ink">
              {t('ocrModelNameLabel')}
            </span>
            <input
              value={modelName}
              onChange={(event) => setModelName(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('ocrModelNamePlaceholder')}
              className="h-11 w-full rounded-lg border border-line bg-white px-3 font-mono text-sm outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
            />
          </label>

          <div className="flex flex-col gap-3 rounded-lg bg-neutral-50 p-4 text-sm text-ink/65 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <HiOutlineDatabase className="mt-0.5 size-5 shrink-0 text-ink/45" />
              <div>
                <div>{t('ocrModelFallbackLabel')}</div>
                <div className="mt-1 break-all font-mono text-xs text-ink/55">
                  {settings?.envFallbackModel || '—'}
                </div>
              </div>
            </div>
            <Button type="submit" size="sm" loading={saving} className="h-10 justify-center">
              <HiOutlineSave className="size-4" />
              {t('ocrModelSave')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
