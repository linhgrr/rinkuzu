'use client';

import { useState, type FormEvent } from 'react';
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
import { Select } from '@/components/ui/Select';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';
import { createCampaign, fetchCampaigns } from '../api/communications-api';

export function AdminCampaignsPage() {
  const router = useRouter();
  const t = useTranslations('communications.admin');
  const describeError = useAdminApiErrorMessage();
  const [page, setPage] = useState(1);
  const {
    data,
    error: loadError,
    mutate,
  } = useSWR(`/api/admin/campaigns?page=${page}`, () => fetchCampaigns(page), {
    refreshInterval: 20_000,
  });
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState<'product_updates' | 'promotions'>('product_updates');
  const [locale, setLocale] = useState('');
  const [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const detail = await createCampaign({
        name,
        subject,
        topic,
        blocks: [{ id: crypto.randomUUID(), type: 'paragraph', text: body }],
        locale: locale || undefined,
        planId: planId || undefined,
      });
      await mutate();
      router.push(`/admin/campaigns/${detail.campaign.id}`);
    } catch (caught) {
      setError(describeError(caught, t('campaignCreateError')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Email Campaigns"
        description="Broadcast chỉ gửi tới user đã opt-in đúng topic."
      />
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tạo campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <Input
                label="Tên nội bộ"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <Input
                label="Email subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
              />
              <Select
                label="Topic"
                value={topic}
                onChange={(event) =>
                  setTopic(event.target.value === 'promotions' ? 'promotions' : 'product_updates')
                }
              >
                <option value="product_updates">Cập nhật sản phẩm</option>
                <option value="promotions">Khuyến mãi</option>
              </Select>
              <Select
                label="Ngôn ngữ audience"
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
              >
                <option value="">Tất cả ngôn ngữ</option>
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </Select>
              <Input
                label="Plan ID (không bắt buộc)"
                value={planId}
                onChange={(event) => setPlanId(event.target.value)}
              />
              <Textarea
                label="Đoạn nội dung đầu tiên"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                rows={6}
              />
              {error ? <ErrorState message={error} /> : null}
              <Button type="submit" loading={loading}>
                Tạo bản nháp
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* A failed load replaced the list with nothing at all (RIN-1159). */}
            {loadError ? (
              <ErrorState
                error={loadError}
                message={t('campaignsLoadError')}
                onRetry={() => mutate()}
              />
            ) : null}
            {data?.items.map((campaign) => (
              <ButtonBase
                key={campaign.id}
                type="button"
                onClick={() => router.push(`/admin/campaigns/${campaign.id}`)}
                className="w-full rounded-lg border border-line p-4 text-left hover:bg-accent-soft/40"
              >
                <span className="font-semibold">{campaign.name}</span>
                <span className="mt-1 block text-sm text-ink-muted">
                  {campaign.status} · {campaign.recipientCount} recipients
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
