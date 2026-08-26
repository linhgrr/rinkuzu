'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { ButtonBase } from '@/components/ui/ButtonBase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { formatCommunicationTimestamp } from '../lib/format';
import {
  createSupportTicket,
  fetchSupportTickets,
  uploadSupportImage,
} from '../api/communications-api';

export function SupportCenterPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('communications.support');
  const [page, setPage] = useState(1);
  const { data, error, isLoading, mutate } = useSWR(
    `/api/support/tickets?page=${page}`,
    () => fetchSupportTickets(false, page),
    { refreshInterval: 20_000 },
  );
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('general');
  const filesRef = useRef<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const attachmentIds = await Promise.all(filesRef.current.map(uploadSupportImage));
      const result = await createSupportTicket({
        subject,
        category,
        body,
        attachmentIds,
        clientMessageId: crypto.randomUUID(),
      });
      await mutate();
      filesRef.current = [];
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.push(`/support/${result.ticket.id}`);
    } catch (caught) {
      setFormError(extractUnknownErrorMessage(caught, t('createError')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <Input
              label={t('subject')}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
              minLength={4}
              maxLength={160}
            />
            <Select
              label={t('category')}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="general">{t('categories.general')}</option>
              <option value="account">{t('categories.account')}</option>
              <option value="billing">{t('categories.billing')}</option>
              <option value="technical">{t('categories.technical')}</option>
              <option value="feedback">{t('categories.feedback')}</option>
            </Select>
            <Textarea
              label={t('body')}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
              minLength={1}
              maxLength={20_000}
              rows={7}
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
            {formError ? (
              <p role="alert" className="text-sm text-error">
                {formError}
              </p>
            ) : null}
            <Button type="submit" loading={submitting}>
              {t('submit')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('listTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <p>{t('loading')}</p> : null}
          {error ? (
            <p role="alert" className="text-error">
              {t('listError')}
            </p>
          ) : null}
          {data?.items.length === 0 ? (
            <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
          ) : null}
          <div className="space-y-3">
            {data?.items.map((ticket) => (
              <ButtonBase
                key={ticket.id}
                type="button"
                onClick={() => router.push(`/support/${ticket.id}`)}
                className="w-full rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="block font-semibold text-ink">{ticket.subject}</span>
                <span className="mt-1 block text-sm text-ink-muted">
                  {t(`statuses.${ticket.status}`)} ·{' '}
                  {formatCommunicationTimestamp(ticket.lastMessageAt, locale)}
                </span>
              </ButtonBase>
            ))}
          </div>
          {data && data.pagination.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('previous')}
              </Button>
              <span className="text-sm text-ink-muted">
                {page}/{data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('next')}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
