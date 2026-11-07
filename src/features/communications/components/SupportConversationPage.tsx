'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import Image, { type ImageLoaderProps } from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Input';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { formatCommunicationTimestamp } from '../lib/format';
import { validateSupportReply, type SupportFieldError } from '../lib/support-form';
import {
  addSupportMessage,
  fetchSupportDetail,
  reopenSupport,
  updateSupportStatus,
  uploadSupportImage,
} from '../api/communications-api';
import type {
  SupportDetailViewModel,
  SupportTicketViewModel,
} from '../types/communication-view-model';
import { BackToListLink, DetailLoadError } from './DetailLoadError';
import { SupportAttachmentPicker } from './SupportAttachmentPicker';
import {
  SupportFieldMessage,
  SupportFormAlert,
  SupportStatusBadge,
  SupportTicketNote,
} from './SupportUi';

interface SupportConversationPageProps {
  ticketId: string;
  admin?: boolean;
}

export function SupportConversationPage({ ticketId, admin = false }: SupportConversationPageProps) {
  const t = useTranslations('communications.support');
  const apiErrorMessage = useApiErrorMessage();
  const { data, error, isLoading, mutate } = useSWR(
    `support:${admin}:${ticketId}`,
    () => fetchSupportDetail(ticketId, admin),
    { refreshInterval: 15_000 },
  );
  const [reopening, setReopening] = useState(false);
  const [actionError, setActionError] = useState('');

  async function changeStatus(status: string): Promise<void> {
    if (!data) return;
    try {
      await updateSupportStatus(ticketId, status, data.ticket.revision, data.ticket.priority);
      await mutate();
    } catch (caught) {
      setActionError(apiErrorMessage(caught));
    }
  }

  function reopen(): void {
    setReopening(true);
    setActionError('');
    void reopenSupport(ticketId)
      .then(() => mutate())
      .catch((caught: unknown) => {
        setActionError(apiErrorMessage(caught));
      })
      .finally(() => setReopening(false));
  }

  const listHref = admin ? '/admin/support' : '/support';
  const backLink = <BackToListLink href={listHref} label={t('backToRequests')} />;

  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {backLink}
        <p>{t('conversationLoading')}</p>
      </div>
    );
  if (error || !data)
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <DetailLoadError
          href={listHref}
          label={t('backToRequests')}
          title={t('conversationTitle')}
          error={error}
          message={t('conversationError')}
          onRetry={() => mutate()}
        />
      </div>
    );
  const { ticket } = data;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {backLink}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="break-words font-home text-2xl font-semibold tracking-tight text-ink">
                {ticket.subject}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <SupportStatusBadge status={ticket.status} />
                <span className="break-all">
                  {ticket.userEmail ?? t(`categories.${ticket.category}`)}
                </span>
              </div>
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
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <SupportMessageList messages={data.messages} admin={admin} />
        </CardContent>
      </Card>
      {admin ? null : (
        <SupportTicketStateNote ticket={ticket} reopening={reopening} onReopen={reopen} />
      )}
      {ticket.status !== 'closed' ? (
        <SupportReplyCard ticketId={ticketId} admin={admin} onSent={() => mutate()} />
      ) : null}
      {actionError ? <SupportFormAlert message={actionError} /> : null}
    </div>
  );
}

function SupportMessageList({
  messages,
  admin,
}: {
  messages: SupportDetailViewModel['messages'];
  admin: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('communications.support');
  const learnerLabel = admin ? t('authorLearner') : t('authorYou');

  if (messages.length === 0) {
    return <p className="text-sm text-ink-muted">{t('noMessages')}</p>;
  }

  return (
    <ol className="space-y-4" aria-label={t('history')}>
      {messages.map((message) => {
        const fromSupport = message.authorRole === 'admin';
        return (
          <li
            key={message.id}
            className={`max-w-[85%] break-words rounded-xl p-4 ${fromSupport ? 'ml-auto bg-accent-soft' : 'bg-surface-warm'}`}
          >
            <p className="mb-1 text-xs font-semibold text-ink">
              {fromSupport ? t('authorSupport') : learnerLabel}
            </p>
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
        );
      })}
    </ol>
  );
}

/** What a resolved or closed ticket allows next (RIN-1018). */
function SupportTicketStateNote({
  ticket,
  reopening,
  onReopen,
}: {
  ticket: SupportTicketViewModel;
  reopening: boolean;
  onReopen: () => void;
}) {
  const t = useTranslations('communications.support');

  if (ticket.status === 'resolved') {
    return (
      <SupportTicketNote>
        <p>{t('resolvedNote')}</p>
      </SupportTicketNote>
    );
  }
  if (ticket.status !== 'closed') return null;
  if (ticket.canReopen) {
    return (
      <SupportTicketNote>
        <p>{t('closedReopenNote')}</p>
        <Button variant="outline" size="sm" loading={reopening} onClick={onReopen}>
          {t('reopen')}
        </Button>
      </SupportTicketNote>
    );
  }
  return (
    <SupportTicketNote>
      <p>{t('closedFinalNote')}</p>
      <Link
        href="/support"
        className="inline-flex font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t('newRequest')}
      </Link>
    </SupportTicketNote>
  );
}

function SupportReplyCard({
  ticketId,
  admin,
  onSent,
}: {
  ticketId: string;
  admin: boolean;
  onSent: () => Promise<unknown>;
}) {
  const t = useTranslations('communications.support');
  const apiErrorMessage = useApiErrorMessage();
  const replyErrorId = useId();
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fieldError, setFieldError] = useState<SupportFieldError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState('');

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const invalid = validateSupportReply(body);
    setFieldError(invalid);
    if (invalid) {
      replyRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setSendError('');
    try {
      const attachmentIds = await Promise.all(files.map(uploadSupportImage));
      await addSupportMessage(ticketId, body, attachmentIds, admin);
      setBody('');
      setFiles([]);
      await onSent();
    } catch (caught) {
      setSendError(apiErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form className="space-y-4" onSubmit={submit} noValidate>
          <div>
            <Textarea
              ref={replyRef}
              label={t('reply')}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setFieldError(null);
              }}
              required
              maxLength={20_000}
              rows={5}
              className={fieldError ? 'border-error' : undefined}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? replyErrorId : undefined}
            />
            {fieldError ? (
              <SupportFieldMessage id={replyErrorId}>
                {t(`errors.${fieldError}`)}
              </SupportFieldMessage>
            ) : null}
          </div>
          <SupportAttachmentPicker files={files} onChange={setFiles} disabled={submitting} />
          {sendError ? <SupportFormAlert message={sendError} /> : null}
          <Button type="submit" loading={submitting}>
            {t('sendReply')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function passthroughImageLoader({ src }: ImageLoaderProps): string {
  return src;
}
