'use client';

import { useRef, useState, type FormEvent } from 'react';
import Image, { type ImageLoaderProps } from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Input';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { formatCommunicationTimestamp } from '../lib/format';
import {
  addSupportMessage,
  fetchSupportDetail,
  reopenSupport,
  updateSupportStatus,
  uploadSupportImage,
} from '../api/communications-api';

interface SupportConversationPageProps {
  ticketId: string;
  admin?: boolean;
}

export function SupportConversationPage({ ticketId, admin = false }: SupportConversationPageProps) {
  const locale = useLocale();
  const t = useTranslations('communications.support');
  const { data, error, isLoading, mutate } = useSWR(
    `support:${admin}:${ticketId}`,
    () => fetchSupportDetail(ticketId, admin),
    { refreshInterval: 15_000 },
  );
  const [body, setBody] = useState('');
  const filesRef = useRef<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setActionError('');
    try {
      const attachmentIds = await Promise.all(filesRef.current.map(uploadSupportImage));
      await addSupportMessage(ticketId, body, attachmentIds, admin);
      setBody('');
      filesRef.current = [];
      if (fileInputRef.current) fileInputRef.current.value = '';
      await mutate();
    } catch (caught) {
      setActionError(extractUnknownErrorMessage(caught, t('sendError')));
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(status: string): Promise<void> {
    if (!data) return;
    try {
      await updateSupportStatus(ticketId, status, data.ticket.revision, data.ticket.priority);
      await mutate();
    } catch (caught) {
      setActionError(extractUnknownErrorMessage(caught, 'Không thể cập nhật ticket'));
    }
  }

  if (isLoading) return <div className="p-8">{t('conversationLoading')}</div>;
  if (error || !data)
    return (
      <div role="alert" className="p-8 text-error">
        {t('conversationError')}
      </div>
    );
  const closed = data.ticket.status === 'closed';

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{data.ticket.subject}</CardTitle>
              <p className="mt-1 text-sm text-ink-muted">
                {data.ticket.userEmail ?? data.ticket.category} ·{' '}
                {t(`statuses.${data.ticket.status}`)}
              </p>
            </div>
            {admin ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => changeStatus('resolved')}>
                  Đã xử lý
                </Button>
                <Button variant="destructive" size="sm" onClick={() => changeStatus('closed')}>
                  Đóng
                </Button>
              </div>
            ) : data.ticket.canReopen ? (
              <Button
                variant="outline"
                loading={submitting}
                onClick={() => {
                  setSubmitting(true);
                  setActionError('');
                  void reopenSupport(ticketId)
                    .then(() => mutate())
                    .catch((caught) => {
                      setActionError(extractUnknownErrorMessage(caught, t('reopenError')));
                    })
                    .finally(() => setSubmitting(false));
                }}
              >
                {t('reopen')}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4" aria-label={t('history')}>
            {data.messages.map((message) => (
              <li
                key={message.id}
                className={`max-w-[85%] rounded-xl p-4 ${message.authorRole === 'admin' ? 'ml-auto bg-accent-soft' : 'bg-surface-warm'}`}
              >
                <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                {message.attachments.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {message.attachments.map((attachment) => (
                      <Image
                        key={attachment.id}
                        src={attachment.url}
                        alt={t('attachmentAlt')}
                        loader={passthroughImageLoader}
                        unoptimized
                        width={attachment.width ?? 800}
                        height={attachment.height ?? 600}
                        className="max-h-48 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                ) : null}
                <time className="mt-2 block text-xs text-ink-muted" dateTime={message.createdAt}>
                  {formatCommunicationTimestamp(message.createdAt, locale)}
                </time>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      {!closed ? (
        <Card>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={submit}>
              <Textarea
                label={t('reply')}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                maxLength={20_000}
                rows={5}
              />
              <label className="block text-xs font-semibold text-ink">
                {t('attachments')}
                <input
                  className="mt-2 block w-full text-sm"
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(event) => {
                    filesRef.current = Array.from(event.target.files ?? []).slice(0, 3);
                  }}
                />
              </label>
              {actionError ? (
                <p role="alert" className="text-sm text-error">
                  {actionError}
                </p>
              ) : null}
              <Button type="submit" loading={submitting}>
                {t('sendReply')}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function passthroughImageLoader({ src }: ImageLoaderProps): string {
  return src;
}
