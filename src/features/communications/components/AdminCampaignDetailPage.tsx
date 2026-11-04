'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Image, { type ImageLoaderProps } from 'next/image';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';
import { CampaignBlockEditor } from './CampaignBlockEditor';
import {
  cancelCampaign,
  fetchCampaignDetail,
  prepareCampaign,
  scheduleCampaign,
  testCampaign,
  updateCampaign,
} from '../api/communications-api';
import type {
  CampaignBlockViewModel,
  CampaignDetailViewModel,
} from '../types/communication-view-model';

export function AdminCampaignDetailPage({ id }: { id: string }) {
  const t = useTranslations('communications.admin');
  const describeError = useAdminApiErrorMessage();
  const { data, error, mutate } = useSWR(`campaign:${id}`, () => fetchCampaignDetail(id), {
    refreshInterval: 10_000,
  });
  // Described once per error object: the 10 s refresh re-renders, and describing logs.
  const loadError = useMemo(
    () => (error ? describeError(error, t('campaignLoadError')) : ''),
    [describeError, error, t],
  );
  if (error)
    return (
      <div role="alert" className="p-8 text-error">
        {loadError}
      </div>
    );
  if (!data) return <div className="p-8">Đang tải…</div>;
  return (
    <CampaignEditor
      key={`${id}:${data.campaign.revision}`}
      id={id}
      detail={data}
      onRefresh={async () => {
        await mutate();
      }}
    />
  );
}

interface CampaignEditorProps {
  id: string;
  detail: CampaignDetailViewModel;
  onRefresh: () => Promise<void>;
}

function CampaignEditor({ id, detail, onRefresh }: CampaignEditorProps) {
  const campaign = detail.campaign;
  const [name, setName] = useState(campaign.name);
  const [subject, setSubject] = useState(campaign.subject);
  const [previewText, setPreviewText] = useState(campaign.previewText ?? '');
  const [blocks, setBlocks] = useState<CampaignBlockViewModel[]>(campaign.blocks);
  const [locale, setLocale] = useState(campaign.locale ?? '');
  const [planId, setPlanId] = useState(campaign.planId ?? '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const t = useTranslations('communications.admin');
  const describeError = useAdminApiErrorMessage();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const draftInput = useMemo(
    () => ({
      name,
      subject,
      previewText: previewText || undefined,
      topic: campaign.topic,
      blocks,
      locale: locale || undefined,
      planId: planId || undefined,
    }),
    [blocks, campaign.topic, locale, name, planId, previewText, subject],
  );
  const isDirty =
    campaign.status === 'draft' &&
    JSON.stringify(draftInput) !==
      JSON.stringify({
        name: campaign.name,
        subject: campaign.subject,
        previewText: campaign.previewText ?? undefined,
        topic: campaign.topic,
        blocks: campaign.blocks,
        locale: campaign.locale ?? undefined,
        planId: campaign.planId ?? undefined,
      });

  async function action(run: () => Promise<unknown>, success: string): Promise<void> {
    setBusy(true);
    setNotice(null);
    try {
      await run();
      setNotice({ tone: 'success', text: success });
      await onRefresh();
    } catch (caught) {
      const text = describeError(caught, t('campaignActionError'));
      setNotice(text ? { tone: 'error', text } : null);
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    await action(() => persistDraft(), 'Đã lưu bản nháp');
  }

  function persistDraft(): Promise<CampaignDetailViewModel> {
    return updateCampaign(id, { ...draftInput, revision: campaign.revision });
  }

  async function withCurrentDraft(run: (revision: number) => Promise<unknown>): Promise<unknown> {
    const current = isDirty ? await persistDraft() : detail;
    return run(current.campaign.revision);
  }

  function schedule(): void {
    const instant = new Date(scheduledAt);
    if (!scheduledAt || Number.isNaN(instant.getTime())) {
      setNotice({ tone: 'error', text: 'Hãy chọn thời gian gửi hợp lệ' });
      return;
    }
    void action(
      () => scheduleCampaign(id, campaign.revision, instant.toISOString(), confirmation),
      'Đã lên lịch',
    );
  }

  const draft = campaign.status === 'draft';

  return (
    <AdminPageShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-ink-muted">
            {campaign.status} · {campaign.recipientCount} recipients · revision {campaign.revision}
          </p>
        </div>
        {['draft', 'preparing_audience', 'ready', 'scheduled', 'sending'].includes(
          campaign.status,
        ) ? (
          <Button
            variant="destructive"
            loading={busy}
            disabled={busy}
            onClick={() => setConfirmCancel(true)}
          >
            Dừng khẩn cấp
          </Button>
        ) : null}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Block editor</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={save}>
              <Input
                label="Tên nội bộ"
                value={name}
                disabled={!draft}
                onChange={(event) => setName(event.target.value)}
              />
              <Input
                label="Subject"
                value={subject}
                disabled={!draft}
                onChange={(event) => setSubject(event.target.value)}
              />
              <Input
                label="Preview text"
                value={previewText}
                disabled={!draft}
                onChange={(event) => setPreviewText(event.target.value)}
              />
              <Select
                label="Ngôn ngữ audience"
                value={locale}
                disabled={!draft}
                onChange={(event) => setLocale(event.target.value)}
              >
                <option value="">Tất cả ngôn ngữ</option>
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </Select>
              <Input
                label="Plan ID (không bắt buộc)"
                value={planId}
                disabled={!draft}
                onChange={(event) => setPlanId(event.target.value)}
              />
              <CampaignBlockEditor blocks={blocks} disabled={!draft} onChange={setBlocks} />
              {draft ? (
                <Button type="submit" loading={busy} disabled={busy || !isDirty}>
                  Lưu bản nháp
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Kiểm soát gửi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft ? (
                <>
                  <Button
                    className="w-full"
                    variant="outline"
                    loading={busy}
                    disabled={busy}
                    onClick={() =>
                      action(
                        () => withCurrentDraft((revision) => testCampaign(id, revision)),
                        'Đã gửi test',
                      )
                    }
                  >
                    Gửi test cho admin
                  </Button>
                  <Button
                    className="w-full"
                    loading={busy}
                    disabled={busy}
                    onClick={() =>
                      action(
                        () => withCurrentDraft((revision) => prepareCampaign(id, revision)),
                        'Đang chuẩn bị audience',
                      )
                    }
                  >
                    Cố định audience
                  </Button>
                  {isDirty ? (
                    <p className="text-sm text-warning">
                      Nội dung chưa lưu sẽ được lưu tự động trước khi test hoặc cố định audience.
                    </p>
                  ) : null}
                  {campaign.testedAt ? (
                    <p className="text-sm text-ink-muted">
                      Bản hiện tại đã test:{' '}
                      {campaign.testedContentHash === campaign.contentHash ? 'có' : 'không'}
                    </p>
                  ) : null}
                </>
              ) : null}
              {campaign.status === 'preparing_audience' ? (
                <p className="text-sm text-ink-muted">
                  Worker đang đồng bộ contacts vào immutable Resend segment…
                </p>
              ) : null}
              {campaign.status === 'ready' ? (
                <>
                  <Input
                    label="Thời gian gửi"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                  <Input
                    label={`Nhập GỬI ${campaign.recipientCount}`}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                  <Button
                    className="w-full"
                    loading={busy}
                    disabled={busy || !scheduledAt || !confirmation}
                    onClick={schedule}
                  >
                    Lên lịch gửi
                  </Button>
                </>
              ) : null}
              {notice?.tone === 'error' ? (
                <p role="alert" className="text-sm text-error">
                  {notice.text}
                </p>
              ) : null}
              {notice?.tone === 'success' ? (
                <p role="status" className="text-sm text-ink-muted">
                  {notice.text}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-line bg-white p-5 text-slate-900">
                <p className="mb-4 text-xs text-slate-500">
                  {previewText || 'Không có preview text'}
                </p>
                <CampaignPreview blocks={blocks} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Metrics tổng hợp</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(campaign.metrics).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-ink-muted">{key}</dt>
                    <dd className="text-lg font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              {campaign.stopReason ? (
                <p className="mt-4 text-sm text-error">{campaign.stopReason}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
      <ConfirmModal
        isOpen={confirmCancel}
        title="Dừng khẩn cấp campaign?"
        message="Các lượt gửi chưa bắt đầu sẽ bị hủy. Hành động này không thể hoàn tác."
        confirmText="Dừng campaign"
        isLoading={busy}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          void action(() => cancelCampaign(id, campaign.revision), 'Đã dừng campaign').finally(() =>
            setConfirmCancel(false),
          );
        }}
      />
    </AdminPageShell>
  );
}

function CampaignPreview({ blocks }: { blocks: CampaignBlockViewModel[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block) => {
        if (block.type === 'heading') {
          const className =
            block.level === 1 ? 'text-2xl' : block.level === 2 ? 'text-xl' : 'text-lg';
          return (
            <p key={block.id} className={`${className} font-bold`}>
              {block.text}
            </p>
          );
        }
        if (block.type === 'paragraph')
          return (
            <p key={block.id} className="whitespace-pre-wrap">
              {block.text}
            </p>
          );
        if (block.type === 'image')
          return (
            <Image
              key={block.id}
              src={block.url}
              alt={block.label}
              loader={passthroughImageLoader}
              unoptimized
              width={600}
              height={400}
              className="h-auto max-w-full"
            />
          );
        if (block.type === 'button')
          return (
            <span
              key={block.id}
              className="inline-block rounded-md bg-slate-900 px-4 py-2 text-white"
            >
              {block.label}
            </span>
          );
        if (block.type === 'divider') return <hr key={block.id} className="border-slate-200" />;
        return <div key={block.id} aria-hidden="true" style={{ height: block.height }} />;
      })}
    </div>
  );
}

function passthroughImageLoader({ src }: ImageLoaderProps): string {
  return src;
}
