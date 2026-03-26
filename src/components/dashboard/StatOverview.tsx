import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import {
    HiOutlineFire,
    HiOutlineLightningBolt,
    HiOutlineTrendingUp,
    HiOutlineLightBulb,
} from '@/components/icons';

interface StatOverviewProps {
    stats?: {
        streak?: number;
        xp?: number;
        averageAccuracy?: number;
        dueCount?: number;
    };
    labels: {
        dailyStreak: string;
        days: string;
        totalXP: string;
        accuracy: string;
        toReview: string;
    };
}

function StatCard({
    icon,
    eyebrow,
    value,
    tone,
}: {
    icon: ReactNode;
    eyebrow: string;
    value: string;
    tone: string;
}) {
    return (
        <div className="flex items-center gap-4 bg-white p-5 transition-colors duration-300 hover:bg-slate-50/80">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{eyebrow}</p>
                <p className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    {value}
                </p>
            </div>
        </div>
    );
}

export function StatOverview({ stats, labels }: StatOverviewProps) {
    return (
        <Card className="overflow-hidden rounded-2xl shadow-sm border-slate-200 p-0 bg-slate-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-[1px]">
                <StatCard
                    icon={<HiOutlineFire className="text-2xl text-orange-500" />}
                    eyebrow={labels.dailyStreak}
                    value={`${stats?.streak || 0} ${labels.days}`}
                    tone="border border-orange-100 bg-orange-50 text-orange-600"
                />
                <StatCard
                    icon={<HiOutlineLightningBolt className="text-2xl text-amber-500" />}
                    eyebrow={labels.totalXP}
                    value={String(stats?.xp || 0)}
                    tone="border border-amber-100 bg-amber-50 text-amber-600"
                />
                <StatCard
                    icon={<HiOutlineTrendingUp className="text-2xl" />}
                    eyebrow={labels.accuracy}
                    value={`${stats?.averageAccuracy || 0}%`}
                    tone="bg-slate-50 text-slate-900"
                />
                <StatCard
                    icon={<HiOutlineLightBulb className="text-2xl" />}
                    eyebrow={labels.toReview}
                    value={String(stats?.dueCount || 0)}
                    tone="bg-slate-100 text-slate-600"
                />
            </div>
        </Card>
    );
}
