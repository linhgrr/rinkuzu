'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  archiveAdminPromotion,
  createAdminPromotion,
  fetchAdminPromotions,
  type AdminPromotion,
} from '@/features/admin/promotions/api/admin-promotions-api';
import { formatVndCurrency } from '@/lib/formatters';

type PromotionKind = 'percentage' | 'fixed';

function localInputDate(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function promotionValue(promotion: AdminPromotion): string {
  return promotion.kind === 'fixed'
    ? formatVndCurrency(promotion.fixedAmount ?? 0)
    : `${promotion.percentageOff ?? 0}%`;
}

export default function AdminPromotionsPage() {
  const [items, setItems] = useState<AdminPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<PromotionKind>('percentage');
  const [percentage, setPercentage] = useState(10);
  const [fixedAmount, setFixedAmount] = useState(20_000);
  const [minimumSubtotal, setMinimumSubtotal] = useState(0);
  const [totalLimit, setTotalLimit] = useState(100);
  const [perUserLimit, setPerUserLimit] = useState(1);
  const [firstPurchase, setFirstPurchase] = useState(false);
  const [startsAt, setStartsAt] = useState(localInputDate(0));
  const [endsAt, setEndsAt] = useState(localInputDate(30));

  const reload = () =>
    fetchAdminPromotions()
      .then(setItems)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : 'Không tải được promo'),
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    void fetchAdminPromotions()
      .then(setItems)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : 'Không tải được promo'),
      )
      .finally(() => setLoading(false));
  }, []);

  const create = async () => {
    setSaving(true);
    try {
      await createAdminPromotion({
        code,
        kind,
        ...(kind === 'percentage' ? { percentageOff: percentage } : { fixedAmount }),
        minimumSubtotal,
        eligibilityClass: firstPurchase ? 'first_purchase' : 'public',
        totalLimit,
        perUserLimit,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      setCode('');
      toast.success('Đã tạo promo');
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tạo được promo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminPageHeader title="Promotions" description="Tạo, theo dõi quota và archive mã ưu đãi." />
      <Card className="mt-6 grid gap-4 p-5 md:grid-cols-3">
        <Input
          label="Mã promo"
          value={code}
          maxLength={32}
          onChange={(event) => setCode(event.target.value)}
        />
        <label className="block text-xs font-semibold text-neutral-700">
          Loại giảm giá
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as PromotionKind)}
            className="input mt-1 w-full"
          >
            <option value="percentage">Theo phần trăm</option>
            <option value="fixed">Số tiền cố định</option>
          </select>
        </label>
        {kind === 'percentage' ? (
          <Input
            label="% giảm"
            type="number"
            min={1}
            max={100}
            value={percentage}
            onChange={(event) => setPercentage(Number(event.target.value))}
          />
        ) : (
          <Input
            label="Số tiền giảm (₫)"
            type="number"
            min={1}
            step={1_000}
            value={fixedAmount}
            onChange={(event) => setFixedAmount(Number(event.target.value))}
          />
        )}
        <Input
          label="Giá trị đơn tối thiểu (₫)"
          type="number"
          min={0}
          step={1_000}
          value={minimumSubtotal}
          onChange={(event) => setMinimumSubtotal(Number(event.target.value))}
        />
        <Input
          label="Tổng lượt"
          type="number"
          min={1}
          value={totalLimit}
          onChange={(event) => setTotalLimit(Number(event.target.value))}
        />
        <Input
          label="Lượt mỗi người"
          type="number"
          min={1}
          value={perUserLimit}
          onChange={(event) => setPerUserLimit(Number(event.target.value))}
        />
        <Input
          label="Bắt đầu"
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
        />
        <Input
          label="Kết thúc"
          type="datetime-local"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={firstPurchase}
            onChange={(event) => setFirstPurchase(event.target.checked)}
          />
          Chỉ lần mua đầu
        </label>
        <Button loading={saving} disabled={!code.trim()} onClick={() => void create()}>
          Tạo promotion
        </Button>
      </Card>

      <div className="mt-6 grid gap-4">
        {loading && <p className="text-ink-muted">Đang tải…</p>}
        {items.map((promotion) => (
          <Card
            key={promotion.id}
            className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-ink">{promotion.code}</strong>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    promotion.active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {promotion.active ? 'Active' : 'Archived'}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {promotionValue(promotion)} · reserved {promotion.reservedCount} · redeemed{' '}
                {promotion.redeemedCount}
                {promotion.totalLimit ? ` / ${promotion.totalLimit}` : ''}
                {promotion.overrunCount ? ` · overrun ${promotion.overrunCount}` : ''}
              </p>
            </div>
            {promotion.active && (
              <Button
                variant="outline"
                onClick={() => void archiveAdminPromotion(promotion.id).then(() => reload())}
              >
                Archive
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
