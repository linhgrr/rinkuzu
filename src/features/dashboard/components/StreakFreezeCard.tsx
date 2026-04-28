'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface StreakFreezeCardProps {
  count: number;
  xp: number;
  labels: {
    streakFreeze: string;
    streakFreezeEquipped: string;
    streakFreezeNotEquipped: string;
    buyXP: string;
    maxedOut: string;
    failedToBuyFreeze: string;
    failedToConnectServer: string;
  };
  embedded?: boolean;
}

interface BuyFreezeResponse {
  success: boolean;
  message?: string;
  data?: {
    xp: number;
    streakFreezeCount: number;
  };
}

const MAX_FREEZES = 2;
const COST = 500;

function formatMessage(template: string, params: Record<string, string | number>) {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

export function StreakFreezeCard({ count, xp, labels, embedded = false }: StreakFreezeCardProps) {
  const [buying, setBuying] = useState(false);
  const [currentCount, setCurrentCount] = useState(count);
  const [currentXp, setCurrentXp] = useState(xp);
  const canBuy = currentCount < MAX_FREEZES && currentXp >= COST;

  const handleBuy = async () => {
    if (!canBuy) return;

    setBuying(true);

    try {
      const response = await fetch('/api/shop/buy-freeze', { method: 'POST' });
      const result = (await response.json()) as BuyFreezeResponse;

      if (!response.ok || !result.success || !result.data) {
        toast.error(result.message || labels.failedToBuyFreeze);
        return;
      }

      setCurrentXp(result.data.xp);
      setCurrentCount(result.data.streakFreezeCount);
    } catch (error) {
      console.error(error);
      toast.error(labels.failedToConnectServer);
    } finally {
      setBuying(false);
    }
  };

  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-neutral-50 border border-neutral-100 rounded-xl flex items-center justify-center text-xl">
          ❄️
        </div>
        <div>
          <p className="font-semibold text-neutral-900">{labels.streakFreeze}</p>
          <p className="text-xs text-neutral-600">
            {currentCount > 0
              ? formatMessage(labels.streakFreezeEquipped, { count: currentCount })
              : labels.streakFreezeNotEquipped}
          </p>
        </div>
      </div>
      <div>
        {currentCount < MAX_FREEZES ? (
          <Button
            size="sm"
            onClick={handleBuy}
            disabled={!canBuy || buying}
            className={
              canBuy
                ? 'bg-neutral-900 hover:bg-black text-white'
                : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
            }
          >
            {buying ? '…' : formatMessage(labels.buyXP, { xp: COST })}
          </Button>
        ) : (
          <span className="text-[10px] font-bold text-neutral-400 px-3 py-1 bg-neutral-50 border border-neutral-100 rounded-full uppercase tracking-wider">
            {labels.maxedOut}
          </span>
        )}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-4">
        {content}
      </div>
    );
  }

  return (
    <Card className="p-5 flex items-center justify-between border-neutral-200 bg-white rounded-2xl shadow-sm hover:border-orange-400 hover:shadow-[0_0_15px_rgba(251,146,60,0.2)] transition-all duration-300">
      {content}
    </Card>
  );
}
