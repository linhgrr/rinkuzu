'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { useRouter } from '@/i18n/navigation';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { Button } from '@/components/ui/Button';
import { ButtonBase } from '@/components/ui/ButtonBase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input, Textarea } from '@/components/ui/Input';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';
import { createSupportTicket, fetchSupportTickets } from '../api/communications-api';

export function AdminSupportPage() {
  const params = useSearchParams();
  const router = useRouter();
  const t = useTranslations('communications.admin');
  const describeError = useAdminApiErrorMessage();
  const [page, setPage] = useState(1);
  const { data, mutate } = useSWR(`/api/admin/support?page=${page}`, () =>
    fetchSupportTickets(true, page),
  );
  const [userId, setUserId] = useState(() => params.get('userId') ?? '');
  const [subject, setSubject] = useState('RinKuzu hỗ trợ bạn');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function create(event: FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const detail = await createSupportTicket(
        {
          userId,
          subject,
          category: 'general',
          body,
          attachmentIds: [],
          clientMessageId: crypto.randomUUID(),
        },
        true,
      );
      await mutate();
      router.push(`/admin/support/${detail.ticket.id}`);
    } catch (caught) {
      setError(describeError(caught, t('supportCreateError')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Support Center"
        description="Trao đổi hỗ trợ riêng với từng user; email chỉ dùng để thông báo."
      />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Mở ticket cho user</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={create}>
              <Input
                label="User ID"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                required
                pattern="[a-fA-F0-9]{24}"
              />
              <Input
                label="Tiêu đề"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
              />
              <Textarea
                label="Nội dung"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                rows={5}
              />
              {error ? <ErrorState message={error} /> : null}
              <Button type="submit" loading={loading}>
                Tạo và gửi thông báo
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inbox hỗ trợ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.items.map((ticket) => (
              <ButtonBase
                key={ticket.id}
                type="button"
                onClick={() => router.push(`/admin/support/${ticket.id}`)}
                className="w-full rounded-lg border border-line p-4 text-left hover:bg-accent-soft/40"
              >
                <span className="font-semibold">{ticket.subject}</span>
                <span className="mt-1 block text-sm text-ink-muted">
                  {ticket.userEmail} · {ticket.status.replaceAll('_', ' ')}
                </span>
              </ButtonBase>
            ))}
            {data && data.pagination.totalPages > 1 ? (
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Trang trước
                </Button>
                <span className="text-sm text-ink-muted">
                  {page}/{data.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Trang sau
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AdminPageShell>
  );
}
