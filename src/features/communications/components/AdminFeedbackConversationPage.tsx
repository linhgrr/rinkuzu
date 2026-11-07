'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Textarea } from '@/components/ui/Input';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';
import { formatCommunicationTimestamp, isFeedbackConversationClosed } from '../lib/format';
import {
  completeFeedback,
  fetchFeedbackDetail,
  remindFeedback,
  replyFeedback,
} from '../api/communications-api';
import { DetailLoadError } from './DetailLoadError';

export function AdminFeedbackConversationPage({ id }: { id: string }) {
  const locale = useLocale();
  const t = useTranslations('communications.admin');
  const describeError = useAdminApiErrorMessage();
  const { data, error, mutate } = useSWR(`feedback-detail:${id}`, () => fetchFeedbackDetail(id), {
    refreshInterval: 15_000,
  });
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  async function reply(event: FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setActionError('');
    try {
      await replyFeedback(id, body);
      setBody('');
      await mutate();
    } catch (caught) {
      setActionError(describeError(caught, t('feedbackReplyError')));
    } finally {
      setLoading(false);
    }
  }

  async function action(run: () => Promise<unknown>, fallback: string): Promise<void> {
    setLoading(true);
    setActionError('');
    try {
      await run();
      await mutate();
    } catch (caught) {
      setActionError(describeError(caught, fallback));
    } finally {
      setLoading(false);
    }
  }

  if (error)
    return (
      <AdminPageShell>
        <DetailLoadError
          href="/admin/feedback"
          label={t('backToFeedback')}
          title={t('feedbackTitle')}
          error={error}
          message={t('feedbackLoadError')}
          onRetry={() => mutate()}
        />
      </AdminPageShell>
    );
  if (!data) return <div className="p-8">{t('loading')}</div>;
  const closed = isFeedbackConversationClosed(data.conversation.status);
  // The invitation is in the outbox but the provider has not accepted it yet.
  // Replying or reminding now would race the invitation itself, so both are
  // withheld until the send is confirmed. Completing stays available: it is the
  // only way to abandon an invitation that keeps failing, and it also cancels
  // the queued email.
  const queued = data.conversation.status === 'queued';

  return (
    <AdminPageShell>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <CardTitle>{data.conversation.subject}</CardTitle>
              <p className="text-sm text-ink-muted">
                {data.conversation.userEmail} · {t(`feedback.statuses.${data.conversation.status}`)}
              </p>
              {queued ? (
                <p role="status" className="mt-1 text-sm text-warning">
                  {t('feedback.queuedNote')}
                </p>
              ) : null}
            </div>
            {!closed ? (
              <div className="flex gap-2">
                {!queued ? (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={loading}
                    disabled={loading}
                    onClick={() => void action(() => remindFeedback(id), t('feedbackRemindError'))}
                  >
                    {t('feedback.remind')}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  loading={loading}
                  disabled={loading}
                  onClick={() =>
                    void action(
                      () => completeFeedback(id, data.conversation.revision),
                      t('feedbackCompleteError'),
                    )
                  }
                >
                  {t('feedback.complete')}
                </Button>
              </div>
            ) : null}
          </div>
          {/* Under the header, next to the buttons that fail, and visible while the reply form is hidden. */}
          {actionError ? <ErrorState message={actionError} className="mt-4" /> : null}
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {data.messages.map((message) => (
              <li
                key={message.id}
                className={`max-w-[85%] rounded-xl p-4 ${message.direction === 'inbound' ? 'bg-surface-warm' : 'ml-auto bg-accent-soft'}`}
              >
                <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                {message.hasAttachments ? (
                  <p className="mt-2 text-xs text-warning">{t('feedback.attachmentNote')}</p>
                ) : null}
                <time className="mt-2 block text-xs text-ink-muted">
                  {formatCommunicationTimestamp(message.createdAt, locale)}
                </time>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      {!closed && !queued ? (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={reply}>
              <Textarea
                label={t('feedback.replyLabel')}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                rows={6}
                maxLength={20_000}
              />
              <Button type="submit" loading={loading}>
                {t('feedback.sendReply')}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </AdminPageShell>
  );
}
