'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { formatCommunicationTimestamp } from '../lib/format';
import { validateSupportRequest, type SupportRequestErrors } from '../lib/support-form';
import {
  createSupportTicket,
  fetchSupportTickets,
  uploadSupportImage,
} from '../api/communications-api';
import { SupportAttachmentPicker } from './SupportAttachmentPicker';
import { SupportFieldMessage, SupportFormAlert, SupportStatusBadge } from './SupportUi';

const SECTION_HEADING_CLASS = 'text-[18px] font-semibold tracking-[-0.015em] text-neutral-900';

export function SupportCenterPage() {
  const t = useTranslations('communications.support');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 font-home text-2xl font-semibold tracking-tight text-ink">
        {t('pageTitle')}
      </h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <NewSupportRequestCard />
        <SupportRequestList />
      </div>
    </div>
  );
}

function NewSupportRequestCard() {
  const router = useRouter();
  const t = useTranslations('communications.support');
  const apiErrorMessage = useApiErrorMessage();
  const subjectErrorId = useId();
  const bodyErrorId = useId();
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('general');
  const [files, setFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<SupportRequestErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const errors = validateSupportRequest(subject, body);
    setFieldErrors(errors);
    if (errors.subject || errors.body) {
      (errors.subject ? subjectRef : bodyRef).current?.focus();
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const attachmentIds = await Promise.all(files.map(uploadSupportImage));
      const result = await createSupportTicket({
        subject,
        category,
        body,
        attachmentIds,
        clientMessageId: crypto.randomUUID(),
      });
      setFiles([]);
      router.push(`/support/${result.ticket.id}`);
    } catch (caught) {
      setFormError(apiErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className={SECTION_HEADING_CLASS}>{t('title')}</h2>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <div>
            <Input
              ref={subjectRef}
              label={t('subject')}
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
                setFieldErrors((current) => ({ ...current, subject: undefined }));
              }}
              required
              maxLength={160}
              className={fieldErrors.subject ? 'border-error' : undefined}
              aria-invalid={fieldErrors.subject ? true : undefined}
              aria-describedby={fieldErrors.subject ? subjectErrorId : undefined}
            />
            {fieldErrors.subject ? (
              <SupportFieldMessage id={subjectErrorId}>
                {t(`errors.${fieldErrors.subject}`)}
              </SupportFieldMessage>
            ) : null}
          </div>
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
          <div>
            <Textarea
              ref={bodyRef}
              label={t('body')}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setFieldErrors((current) => ({ ...current, body: undefined }));
              }}
              required
              maxLength={20_000}
              rows={7}
              className={fieldErrors.body ? 'border-error' : undefined}
              aria-invalid={fieldErrors.body ? true : undefined}
              aria-describedby={fieldErrors.body ? bodyErrorId : undefined}
            />
            {fieldErrors.body ? (
              <SupportFieldMessage id={bodyErrorId}>
                {t(`errors.${fieldErrors.body}`)}
              </SupportFieldMessage>
            ) : null}
          </div>
          <SupportAttachmentPicker files={files} onChange={setFiles} disabled={submitting} />
          {formError ? <SupportFormAlert message={formError} /> : null}
          <Button type="submit" loading={submitting}>
            {t('submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SupportRequestList() {
  const locale = useLocale();
  const t = useTranslations('communications.support');
  const [page, setPage] = useState(1);
  const { data, error, isLoading } = useSWR(
    `/api/support/tickets?page=${page}`,
    () => fetchSupportTickets(false, page),
    { refreshInterval: 20_000 },
  );

  return (
    <Card>
      <CardHeader>
        <h2 className={SECTION_HEADING_CLASS}>{t('listTitle')}</h2>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>{t('loading')}</p> : null}
        {error ? <SupportFormAlert message={t('listError')} /> : null}
        {data?.items.length === 0 ? (
          <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
        ) : null}
        {data?.items.length ? (
          <ul className="space-y-3">
            {data.items.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/support/${ticket.id}`}
                  className="block w-full rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words font-semibold text-ink">
                      {ticket.subject}
                    </span>
                    <SupportStatusBadge status={ticket.status} />
                  </div>
                  <span className="mt-1 block text-sm text-ink-muted">
                    {formatCommunicationTimestamp(ticket.lastMessageAt, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
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
  );
}
