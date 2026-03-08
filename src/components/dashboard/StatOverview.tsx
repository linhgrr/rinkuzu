'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import type { UserStats } from '@/hooks/useStats';
import {
    HiOutlineFire,
    HiOutlineLightningBolt,
    HiOutlineTrendingUp,
    HiOutlineLightBulb,
} from '@/components/icons';

interface StatOverviewProps {
    stats?: UserStats;
}

export const StatOverview = memo(function StatOverview({ stats }: StatOverviewProps) {
    const t = useTranslations('dashboard');

    return (
        <Card className="overflow-hidden rounded-2xl shadow-sm border-slate-200 p-0 bg-slate-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-[1px]">
                {/* Daily Streak */}
                <div className="bg-white p-5 flex items-center gap-4 hover:bg-slate-50/80 transition-colors duration-300">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-orange-50 text-orange-600 border border-orange-100 shrink-0">
                        <HiOutlineFire className="text-2xl text-orange-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{t('dailyStreak')}</p>
                        <p className="text-xl sm:text-2xl font-bold text-slate-900 truncate tracking-tight">
                            {stats?.streak || 0} {t('days')}
                        </p>
                    </div>
                </div>

                {/* Total XP */}
                <div className="bg-white p-5 flex items-center gap-4 hover:bg-slate-50/80 transition-colors duration-300">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
                        <HiOutlineLightningBolt className="text-2xl text-amber-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{t('totalXP')}</p>
                        <p className="text-xl sm:text-2xl font-bold text-slate-900 truncate tracking-tight">
                            {stats?.xp || 0}
                        </p>
                    </div>
                </div>

                {/* Accuracy */}
                <div className="bg-white p-5 flex items-center gap-4 hover:bg-slate-50/80 transition-colors duration-300">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 text-slate-900 shrink-0">
                        <HiOutlineTrendingUp className="text-2xl" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{t('accuracy')}</p>
                        <p className="text-xl sm:text-2xl font-bold text-slate-900 truncate tracking-tight">
                            {stats?.averageAccuracy || 0}%
                        </p>
                    </div>
                </div>

                {/* To Review */}
                <div className="bg-white p-5 flex items-center gap-4 hover:bg-slate-50/80 transition-colors duration-300">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-100 text-slate-600 shrink-0">
                        <HiOutlineLightBulb className="text-2xl" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{t('toReview')}</p>
                        <p className="text-xl sm:text-2xl font-bold text-slate-900 truncate tracking-tight">
                            {stats?.dueCount || 0}
                        </p>
                    </div>
                </div>
            </div>
        </Card>
    );
});
