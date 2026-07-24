'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { HiOutlineCheckCircle, HiOutlineLockClosed, HiOutlineTag } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  cancelCheckoutOrder,
  createCheckoutOrder,
  getCheckoutOrder,
  requestCheckoutQuote,
  verifyCheckoutOrder,
  type CheckoutOrder,
  type CheckoutQuote,
} from '@/features/billing/api/checkout-api';
import { useRouter } from '@/i18n/navigation';
import { formatVndCurrency } from '@/lib/formatters';
import { assertTrustedPayosCheckoutUrl } from '@/lib/security/trusted-navigation';

function statusLabel(order: CheckoutOrder): string {
  if (order.fulfillmentStatus === 'fulfilled') return 'Thanh toán thành công';
  if (order.fulfillmentStatus === 'review') return 'Đang được kiểm tra';
  if (order.collectionStatus === 'partial') return 'Đã nhận một phần thanh toán';
  if (order.collectionStatus === 'paid') return 'Đã nhận tiền, đang kích hoạt';
  return 'Đang chờ thanh toán';
}

export default function CheckoutPage() {
  const params = useSearchParams();
  const router = useRouter();
  const planId = params.get('plan');
  const orderId = params.get('order');
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(Boolean(planId || orderId));
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  const loadQuote = async (code: string | null) => {
    if (!planId) return;
    setLoading(true);
    try {
      setQuote(await requestCheckoutQuote(planId, code));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo báo giá');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      void getCheckoutOrder(orderId)
        .then(setOrder)
        .catch((error: unknown) =>
          toast.error(error instanceof Error ? error.message : 'Không thể tải đơn hàng'),
        )
        .finally(() => setLoading(false));
      return;
    }
    if (!planId) return;
    void requestCheckoutQuote(planId, null)
      .then(setQuote)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : 'Không thể tạo báo giá'),
      )
      .finally(() => setLoading(false));
  }, [orderId, planId]);

  useEffect(() => {
    if (!orderId || order?.fulfillmentStatus === 'fulfilled') return;
    const timer = window.setInterval(() => {
      void getCheckoutOrder(orderId)
        .then(setOrder)
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [order?.fulfillmentStatus, orderId]);

  const submit = async () => {
    if (!quote || !termsAccepted || submitting) return;
    setSubmitting(true);
    try {
      const created = await createCheckoutOrder(quote.token, idempotencyKey.current);
      setOrder(created);
      router.replace(`/checkout?order=${encodeURIComponent(created.id)}`);
      if (created.checkoutUrl) {
        window.location.assign(assertTrustedPayosCheckoutUrl(created.checkoutUrl));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo giao dịch');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-ink-muted">
        Đang tải checkout…
      </div>
    );
  }

  if (!planId && !orderId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card className="p-6 text-center">
          <h1 className="text-xl font-semibold text-ink">Chưa chọn gói</h1>
          <Button className="mt-5" onClick={() => router.push('/subscription')}>
            Chọn gói Premium
          </Button>
        </Card>
      </div>
    );
  }

  if (order) {
    const checkoutUrl = order.checkoutUrl;
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card className="p-6 md:p-8">
          <HiOutlineCheckCircle className="size-11 text-emerald-600" />
          <h1 className="mt-4 text-2xl font-semibold text-ink">{statusLabel(order)}</h1>
          <p className="mt-2 text-ink-muted">
            {order.plan.name} · {formatVndCurrency(order.finalAmount)}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {checkoutUrl && order.fulfillmentStatus !== 'fulfilled' && (
              <Button
                onClick={() => window.location.assign(assertTrustedPayosCheckoutUrl(checkoutUrl))}
              >
                Tiếp tục thanh toán
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => void verifyCheckoutOrder(order.id).then(setOrder)}
            >
              Kiểm tra lại
            </Button>
            {order.collectionStatus === 'unpaid' && (
              <Button
                variant="ghost"
                onClick={() => void cancelCheckoutOrder(order.id).then(setOrder)}
              >
                Hủy đơn
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="p-6 md:p-8">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
            <HiOutlineLockClosed className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-ink">Hoàn tất đăng ký</h1>
            <p className="text-sm text-ink-muted">Giá được xác nhận trước khi tạo giao dịch.</p>
          </div>
        </div>
        <div className="mt-8">
          <Input
            label="Mã ưu đãi"
            value={promoCode}
            maxLength={32}
            icon={<HiOutlineTag />}
            onChange={(event) => setPromoCode(event.target.value)}
            placeholder="Nhập promo code"
          />
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void loadQuote(promoCode.trim() || null)}
          >
            Áp dụng
          </Button>
        </div>
        <label className="mt-8 flex items-start gap-3 rounded-xl bg-neutral-50 p-4 text-sm text-ink">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="mt-0.5 size-4"
          />
          <span>Tôi đồng ý với điều khoản sử dụng và xác nhận thông tin đơn hàng ở bên cạnh.</span>
        </label>
      </Card>

      <Card className="h-fit p-6">
        <h2 className="text-lg font-semibold text-ink">Tóm tắt đơn hàng</h2>
        {quote && (
          <>
            <p className="mt-5 font-medium text-ink">{quote.plan.name}</p>
            <div className="mt-5 space-y-3 border-t border-neutral-200 pt-5 text-sm">
              <div className="flex justify-between">
                <span>Giá gốc</span>
                <span>{formatVndCurrency(quote.quote.baseAmount)}</span>
              </div>
              {quote.quote.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Ưu đãi</span>
                  <span>−{formatVndCurrency(quote.quote.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold">
                <span>Tổng cộng</span>
                <span>{formatVndCurrency(quote.quote.finalAmount)}</span>
              </div>
            </div>
            <Button
              className="mt-6 w-full"
              loading={submitting}
              disabled={!termsAccepted}
              onClick={() => void submit()}
            >
              Thanh toán an toàn
            </Button>
            <p className="mt-3 text-center text-xs text-ink-muted">
              Giao dịch được xử lý qua PayOS.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
