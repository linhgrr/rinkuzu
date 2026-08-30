'use client';

import { FormEvent, Suspense, useEffect, useEffectEvent, useReducer } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import {
  HiOutlineCheckCircle,
  HiOutlineChip,
  HiOutlineEyeOff,
  HiOutlineKey,
  HiOutlineRefresh,
  HiOutlineSave,
  HiOutlineTrash,
  HiOutlineXCircle,
} from 'react-icons/hi';
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TabBar } from '@/components/ui/TabBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  createAdminOcrKey,
  deleteAdminOcrKey,
  fetchAdminOcrKeysViewModel,
  testAdminOcrKey,
  updateAdminOcrKey,
} from '@/features/admin/ocr-keys/api/admin-ocr-keys-api';
import { OcrModelPanel } from '@/features/admin/ocr-keys/components/OcrModelPanel';
import type {
  AdminOcrKeyHealthStatus,
  AdminOcrKeysViewModel,
  AdminOcrKeyViewModel,
} from '@/features/admin/ocr-keys/types/admin-ocr-keys-view-model';
import { extractUnknownErrorMessage } from '@/lib/api/error';

interface State {
  keys: AdminOcrKeyViewModel[];
  fallbackEnvConfigured: boolean;
  loading: boolean;
  saving: boolean;
  refreshing: boolean;
  error: string;
  success: string;
  label: string;
  apiKey: string;
  priority: string;
  rowActionKeyId: string | null;
  replacementKeyById: Record<string, string>;
  keyToDelete: AdminOcrKeyViewModel | null;
}

type Action =
  | { type: 'patch'; value: Partial<State> }
  | { type: 'loaded'; value: AdminOcrKeysViewModel }
  | { type: 'upsert'; key: AdminOcrKeyViewModel; success: string }
  | { type: 'rowUpdated'; key: AdminOcrKeyViewModel; success?: string }
  | { type: 'removed'; keyId: string; success: string }
  | { type: 'replacement'; keyId: string; value: string };

const initialState: State = {
  keys: [],
  fallbackEnvConfigured: false,
  loading: true,
  saving: false,
  refreshing: false,
  error: '',
  success: '',
  label: '',
  apiKey: '',
  priority: '100',
  rowActionKeyId: null,
  replacementKeyById: {},
  keyToDelete: null,
};

const statusVariant: Record<AdminOcrKeyHealthStatus, 'default' | 'success' | 'warning' | 'danger'> =
  {
    healthy: 'success',
    failed: 'danger',
    disabled: 'default',
    untested: 'warning',
  };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'loaded':
      return {
        ...state,
        keys: action.value.keys,
        fallbackEnvConfigured: action.value.fallbackEnvConfigured,
        loading: false,
        refreshing: false,
        error: '',
      };
    case 'upsert':
      return {
        ...state,
        keys: [action.key, ...state.keys.filter((key) => key.id !== action.key.id)].sort(
          (a, b) => a.priority - b.priority,
        ),
        saving: false,
        rowActionKeyId: null,
        success: action.success,
        error: '',
        label: '',
        apiKey: '',
        priority: '100',
        replacementKeyById: { ...state.replacementKeyById, [action.key.id]: '' },
      };
    case 'rowUpdated':
      return {
        ...state,
        keys: [action.key, ...state.keys.filter((key) => key.id !== action.key.id)].sort(
          (a, b) => a.priority - b.priority,
        ),
        rowActionKeyId: null,
        success: action.success ?? '',
        error: '',
        replacementKeyById: { ...state.replacementKeyById, [action.key.id]: '' },
      };
    case 'removed':
      return {
        ...state,
        keys: state.keys.filter((key) => key.id !== action.keyId),
        rowActionKeyId: null,
        keyToDelete: null,
        success: action.success,
        error: '',
      };
    case 'replacement':
      return {
        ...state,
        replacementKeyById: {
          ...state.replacementKeyById,
          [action.keyId]: action.value,
        },
      };
    default:
      return state;
  }
}

const OCR_KEY_DATE_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const ocrKeyDateTimeOptions: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: OCR_KEY_DATE_TIME_ZONE,
};
const ocrKeyDateFormatterEn = new Intl.DateTimeFormat('en', ocrKeyDateTimeOptions);
const ocrKeyDateFormatterVi = new Intl.DateTimeFormat('vi', ocrKeyDateTimeOptions);

function formatDate(value: string | null, locale: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return (locale.startsWith('vi') ? ocrKeyDateFormatterVi : ocrKeyDateFormatterEn).format(date);
}

function AdminOcrKeysContent() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(reducer, initialState);
  const activeTab = searchParams.get('tab') === 'models' ? 'models' : 'keys';

  const activeKeyCount = state.keys.filter((key) => key.enabled).length;
  const failedKeyCount = state.keys.filter((key) => key.status === 'failed').length;

  function selectTab(tab: 'keys' | 'models') {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'keys') params.delete('tab');
    else params.set('tab', tab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  async function loadKeys(options?: { refreshing?: boolean }) {
    dispatch({
      type: 'patch',
      value: { loading: !options?.refreshing, refreshing: !!options?.refreshing, error: '' },
    });
    try {
      const data = await fetchAdminOcrKeysViewModel();
      dispatch({ type: 'loaded', value: data });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          loading: false,
          refreshing: false,
          error: extractUnknownErrorMessage(error, t('ocrKeysLoadError')),
        },
      });
    }
  }

  const onInitialLoad = useEffectEvent(() => {
    void loadKeys();
  });

  useEffect(() => {
    onInitialLoad();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = state.label.trim();
    const apiKey = state.apiKey.trim();
    const priority = Number.parseInt(state.priority, 10);

    if (!label || !apiKey || Number.isNaN(priority)) {
      dispatch({ type: 'patch', value: { error: t('ocrKeysRequiredError'), success: '' } });
      return;
    }

    dispatch({ type: 'patch', value: { saving: true, error: '', success: '' } });
    try {
      const key = await createAdminOcrKey({ label, apiKey, priority });
      dispatch({ type: 'upsert', key, success: t('ocrKeysSaved') });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          saving: false,
          error: extractUnknownErrorMessage(error, t('ocrKeysSaveError')),
        },
      });
    }
  }

  async function patchKey(keyId: string, input: Parameters<typeof updateAdminOcrKey>[1]) {
    dispatch({ type: 'patch', value: { rowActionKeyId: keyId, error: '', success: '' } });
    try {
      const key = await updateAdminOcrKey(keyId, input);
      dispatch({ type: 'rowUpdated', key, success: t('ocrKeysUpdated') });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          rowActionKeyId: null,
          error: extractUnknownErrorMessage(error, t('ocrKeysUpdateError')),
        },
      });
    }
  }

  async function replaceKey(key: AdminOcrKeyViewModel) {
    const apiKey = (state.replacementKeyById[key.id] ?? '').trim();
    if (!apiKey) {
      dispatch({ type: 'patch', value: { error: t('ocrKeysReplacementRequired'), success: '' } });
      return;
    }
    await patchKey(key.id, { apiKey });
  }

  async function testKey(key: AdminOcrKeyViewModel) {
    dispatch({ type: 'patch', value: { rowActionKeyId: key.id, error: '', success: '' } });
    try {
      const result = await testAdminOcrKey(key.id);
      if (result.ok) {
        dispatch({ type: 'rowUpdated', key: result.key, success: t('ocrKeysTestPassed') });
        return;
      }
      dispatch({
        type: 'rowUpdated',
        key: result.key,
        success: '',
      });
      dispatch({
        type: 'patch',
        value: {
          rowActionKeyId: null,
          error: result.errorMessage || t('ocrKeysTestFailed'),
        },
      });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          rowActionKeyId: null,
          error: extractUnknownErrorMessage(error, t('ocrKeysTestFailed')),
        },
      });
    }
  }

  async function confirmRemoveKey() {
    const key = state.keyToDelete;
    if (!key) return;
    dispatch({ type: 'patch', value: { rowActionKeyId: key.id, error: '', success: '' } });
    try {
      await deleteAdminOcrKey(key.id);
      dispatch({ type: 'removed', keyId: key.id, success: t('ocrKeysDeleted') });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          rowActionKeyId: null,
          keyToDelete: null,
          error: extractUnknownErrorMessage(error, t('ocrKeysDeleteError')),
        },
      });
    }
  }

  return (
    <AdminPageShell contentClassName="font-home">
      <AdminPageHeader
        title={t('ocrManagementTitle')}
        description={t('ocrManagementDescription')}
        actions={
          activeTab === 'keys' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadKeys({ refreshing: true })}
              loading={state.refreshing}
            >
              <HiOutlineRefresh className="size-4" />
              {t('refresh')}
            </Button>
          ) : null
        }
      />

      <TabBar
        ariaLabel={t('ocrManagementTabsLabel')}
        className="mb-6 w-full sm:w-fit"
        value={activeTab}
        onChange={selectTab}
        options={[
          {
            value: 'keys',
            label: t('ocrManagementKeysTab'),
            icon: <HiOutlineKey className="size-4" aria-hidden="true" />,
            tabId: 'ocr-keys-tab',
            controlsId: 'ocr-keys-panel',
          },
          {
            value: 'models',
            label: t('ocrManagementModelsTab'),
            icon: <HiOutlineChip className="size-4" aria-hidden="true" />,
            tabId: 'ocr-models-tab',
            controlsId: 'ocr-models-panel',
          },
        ]}
      />

      {activeTab === 'keys' ? (
        <div id="ocr-keys-panel" role="tabpanel" aria-labelledby="ocr-keys-tab">
          <section className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-line-blue/30 bg-white p-4">
              <div className="text-2xl font-semibold text-ink">{state.keys.length}</div>
              <div className="mt-1 text-sm text-ink/55">{t('ocrKeysTotal')}</div>
            </div>
            <div className="rounded-lg border border-line-blue/30 bg-white p-4">
              <div className="text-2xl font-semibold text-ink">{activeKeyCount}</div>
              <div className="mt-1 text-sm text-ink/55">{t('ocrKeysActive')}</div>
            </div>
            <div className="rounded-lg border border-line-blue/30 bg-white p-4">
              <div className="text-2xl font-semibold text-ink">{failedKeyCount}</div>
              <div className="mt-1 text-sm text-ink/55">{t('ocrKeysFailed')}</div>
            </div>
            <div className="rounded-lg border border-line-blue/30 bg-white p-4">
              <div className="text-2xl font-semibold text-ink">
                {state.fallbackEnvConfigured ? t('yes') : t('no')}
              </div>
              <div className="mt-1 text-sm text-ink/55">{t('ocrKeysEnvFallback')}</div>
            </div>
          </section>

          {state.error ? (
            <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          ) : null}
          {state.success ? (
            <div className="mb-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {state.success}
            </div>
          ) : null}

          <form
            onSubmit={handleCreate}
            className="mb-6 grid gap-3 rounded-lg border border-line-blue/30 bg-white p-4 lg:grid-cols-[minmax(180px,1fr)_minmax(260px,2fr)_120px_auto]"
          >
            <input
              value={state.label}
              onChange={(event) =>
                dispatch({ type: 'patch', value: { label: event.target.value } })
              }
              placeholder={t('ocrKeysLabelPlaceholder')}
              className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent"
            />
            <label className="flex h-11 items-center gap-2 rounded-lg border border-line bg-white px-3">
              <HiOutlineEyeOff className="size-5 shrink-0 text-ink/40" />
              <input
                value={state.apiKey}
                onChange={(event) =>
                  dispatch({ type: 'patch', value: { apiKey: event.target.value } })
                }
                type="password"
                autoComplete="off"
                placeholder={t('ocrKeysSecretPlaceholder')}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <input
              value={state.priority}
              onChange={(event) =>
                dispatch({ type: 'patch', value: { priority: event.target.value } })
              }
              inputMode="numeric"
              placeholder={t('ocrKeysPriority')}
              className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent"
            />
            <Button type="submit" size="sm" loading={state.saving} className="h-11 justify-center">
              <HiOutlineSave className="size-4" />
              {t('ocrKeysAdd')}
            </Button>
          </form>

          <section className="overflow-hidden rounded-lg border border-line-blue/30 bg-white">
            <div className="border-b border-line-blue/25 px-5 py-4">
              <h2 className="text-lg font-semibold text-ink">{t('ocrKeysTableTitle')}</h2>
            </div>
            {state.loading ? (
              <div className="space-y-3 p-5 font-home" aria-busy="true">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`ocr-key-skeleton-${index}`}
                    className="flex items-center justify-between gap-4"
                  >
                    <Skeleton className="h-5 w-48 rounded-md" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-5 w-32 rounded-md" />
                    <Skeleton className="h-8 w-24 rounded-md" />
                  </div>
                ))}
              </div>
            ) : state.keys.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink/60">{t('ocrKeysEmpty')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-ink/50">
                    <tr>
                      <th className="px-5 py-3 font-semibold">{t('ocrKeysKey')}</th>
                      <th className="px-5 py-3 font-semibold">{t('status')}</th>
                      <th className="px-5 py-3 font-semibold">{t('ocrKeysUsage')}</th>
                      <th className="px-5 py-3 font-semibold">{t('ocrKeysLastUsed')}</th>
                      <th className="px-5 py-3 font-semibold">{t('ocrKeysReplace')}</th>
                      <th className="px-5 py-3 text-right font-semibold">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-blue/20">
                    {state.keys.map((key) => (
                      <tr key={key.id} className="align-top">
                        <td className="px-5 py-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                              <HiOutlineKey className="size-5" />
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold text-ink">{key.label}</div>
                              <div className="mt-1 font-mono text-xs text-ink/60">
                                {key.maskedKey}
                              </div>
                              <div className="mt-1 text-xs text-ink/45">
                                {key.provider} · {t('ocrKeysPriority')} {key.priority}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-2">
                            <Badge variant={statusVariant[key.status]}>
                              {t(`ocrKeyStatus.${key.status}`)}
                            </Badge>
                            {key.lastErrorMessage ? (
                              <div className="max-w-56 text-xs text-red-600">
                                {key.lastErrorCode ? `${key.lastErrorCode}: ` : ''}
                                {key.lastErrorMessage}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-ink/70">
                          <div>{t('ocrKeysSuccessCount', { count: key.successCount })}</div>
                          <div>{t('ocrKeysFailureCount', { count: key.failureCount })}</div>
                        </td>
                        <td className="px-5 py-4 text-ink/70">
                          <div>{formatDate(key.lastUsedAt, locale)}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex min-w-64 gap-2">
                            <input
                              value={state.replacementKeyById[key.id] ?? ''}
                              onChange={(event) =>
                                dispatch({
                                  type: 'replacement',
                                  keyId: key.id,
                                  value: event.target.value,
                                })
                              }
                              type="password"
                              autoComplete="off"
                              placeholder={t('ocrKeysNewSecretPlaceholder')}
                              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              loading={state.rowActionKeyId === key.id}
                              onClick={() => void replaceKey(key)}
                            >
                              <HiOutlineSave className="size-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              loading={state.rowActionKeyId === key.id}
                              onClick={() => void testKey(key)}
                            >
                              <HiOutlineCheckCircle className="size-4" />
                              {t('ocrKeysTest')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              loading={state.rowActionKeyId === key.id}
                              onClick={() => void patchKey(key.id, { enabled: !key.enabled })}
                            >
                              {key.enabled ? (
                                <HiOutlineXCircle className="size-4" />
                              ) : (
                                <HiOutlineCheckCircle className="size-4" />
                              )}
                              {key.enabled ? t('disable') : t('enable')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              loading={state.rowActionKeyId === key.id}
                              onClick={() =>
                                dispatch({ type: 'patch', value: { keyToDelete: key } })
                              }
                            >
                              <HiOutlineTrash className="size-4" />
                              {t('delete')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <ConfirmModal
            isOpen={!!state.keyToDelete}
            title={t('delete')}
            message={t('ocrKeysDeleteConfirm', { label: state.keyToDelete?.label ?? '' })}
            confirmText={t('delete')}
            cancelText={t('cancel')}
            confirmVariant="destructive"
            isLoading={!!state.keyToDelete && state.rowActionKeyId === state.keyToDelete.id}
            onCancel={() => dispatch({ type: 'patch', value: { keyToDelete: null } })}
            onConfirm={() => {
              void confirmRemoveKey();
            }}
          />
        </div>
      ) : (
        <OcrModelPanel />
      )}
    </AdminPageShell>
  );
}

export function OcrKeysPageClient() {
  return (
    <Suspense fallback={null}>
      <AdminOcrKeysContent />
    </Suspense>
  );
}
