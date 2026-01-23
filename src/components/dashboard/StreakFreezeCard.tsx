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
        <Card className="p-5 flex items-center justify-between border-blue-100/50 bg-blue-50/30 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">
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
                        className={canBuy ? 'bg-blue-600 hover:bg-blue-700' : 'opacity-50 cursor-not-allowed'}
                    >
                        {buying ? '…' : t('buyXP', { xp: COST })}
                    </Button>
                ) : (
                    <span className="text-xs font-bold text-green-600 px-3 py-1 bg-green-100 rounded-full">
                        {t('maxedOut')}
                    </span>
                )}
            </div>
        </Card>
    );
}
