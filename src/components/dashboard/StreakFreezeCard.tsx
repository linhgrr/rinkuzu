'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface StreakFreezeCardProps {
    count: number;
    xp: number;
    onBuy: () => void;
}

export function StreakFreezeCard({ count, xp, onBuy }: StreakFreezeCardProps) {
    const t = useTranslations('dashboard');
    const MAX_FREEZES = 2;
    const COST = 500;
    const canBuy = count < MAX_FREEZES && xp >= COST;

    const [buying, setBuying] = useState(false);

    const handleBuy = async () => {
        if (!canBuy) return;
        setBuying(true);
        await onBuy();
        setBuying(false);
    };

    return (
        <Card className="p-5 flex items-center justify-between border-slate-200 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-xl">
                    ❄️
                </div>
                <div>
                    <p className="font-semibold text-gray-900">{t('streakFreeze')}</p>
                    <p className="text-xs text-gray-600">
                        {count > 0
                            ? t('streakFreezeEquipped', { count })
                            : t('streakFreezeNotEquipped')}
                    </p>
                </div>
            </div>
            <div>
                {count < MAX_FREEZES ? (
                    <Button
                        size="sm"
                        onClick={handleBuy}
                        disabled={!canBuy || buying}
                        className={canBuy ? 'bg-slate-900 hover:bg-black text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}
                    >
                        {buying ? '…' : t('buyXP', { xp: COST })}
                    </Button>
                ) : (
                    <span className="text-[10px] font-bold text-slate-400 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full uppercase tracking-wider">
                        {t('maxedOut')}
                    </span>
                )}
            </div>
        </Card>
    );
}
