'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useRouter } from '@/i18n/navigation';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { Button } from '@/components/ui/Button';
import { ButtonBase } from '@/components/ui/ButtonBase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { createFeedbackInvitation, fetchFeedbackList } from '../api/communications-api';

export function AdminFeedbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const initialUserId = params.get('userId') ?? '';
  const [page, setPage] = useState(1);
  const { data, mutate } = useSWR(`feedback:${initialUserId}:${page}`, () =>
    fetchFeedbackList(initialUserId || undefined, page),
  );
  const [userId, setUserId] = useState(initialUserId);
  const [subject, setSubject] = useState('Bạn thấy trải nghiệm RinKuzu thế nào?');
  const [body, setBody] = useState(
    'Chào bạn,\n\nMình muốn lắng nghe trải nghiệm thật của bạn khi sử dụng RinKuzu. Điều gì đang hữu ích và điều gì khiến bạn chưa hài lòng?',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const detail = await createFeedbackInvitation({
        userId,
        subject,
        body,
      });
      await mutate();
      router.push(`/admin/feedback/${detail.conversation.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi lời mời');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Mời phản hồi"
        description="User trao đổi hoàn toàn bằng email; reply được đồng bộ về đây."
      />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Mời một user</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <Input
                label="User ID"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                required
                pattern="[a-fA-F0-9]{24}"
              />
              <Input
                label="Subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
              />
              <Textarea
                label="Nội dung tự nguyện, không quảng cáo"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                rows={8}
              />
              {error ? (
                <p role="alert" className="text-sm text-error">
                  {error}
                </p>
              ) : null}
              <Button type="submit" loading={loading}>
                Gửi lời mời
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Các cuộc trao đổi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.items.map((conversation) => (
              <ButtonBase
                key={conversation.id}
                type="button"
                onClick={() => router.push(`/admin/feedback/${conversation.id}`)}
                className="w-full rounded-lg border border-line p-4 text-left hover:bg-accent-soft/40"
              >
                <span className="font-semibold">{conversation.subject}</span>
                <span className="mt-1 block text-sm text-ink-muted">
                  {conversation.userEmail} · {conversation.status.replaceAll('_', ' ')}
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
