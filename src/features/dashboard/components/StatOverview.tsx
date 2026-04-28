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
  showDailyStreak?: boolean;
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
    <div className="flex items-center gap-4 bg-white p-5 transition-colors duration-300 hover:bg-neutral-50/80">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          {eyebrow}
        </p>
        <p className="truncate text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
          {value}
        </p>
      </div>
    </div>
  );
}

export function StatOverview({ stats, labels, showDailyStreak = true }: StatOverviewProps) {
  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm border-neutral-200 p-0 bg-neutral-100">
      <div
        className={`grid grid-cols-2 gap-[1px] ${showDailyStreak ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}
      >
        {showDailyStreak ? (
          <StatCard
            icon={<HiOutlineFire className="text-2xl text-orange-500" />}
            eyebrow={labels.dailyStreak}
            value={`${stats?.streak || 0} ${labels.days}`}
            tone="border border-orange-100 bg-orange-50 text-orange-600"
          />
        ) : null}
        <StatCard
          icon={<HiOutlineLightningBolt className="text-2xl text-green-500" />}
          eyebrow={labels.totalXP}
          value={String(stats?.xp || 0)}
          tone="border border-green-100 bg-green-50 text-green-600"
        />
        <StatCard
          icon={<HiOutlineTrendingUp className="text-2xl text-green-500" />}
          eyebrow={labels.accuracy}
          value={`${stats?.averageAccuracy || 0}%`}
          tone="border border-green-100 bg-green-50 text-green-600"
        />
        <StatCard
          icon={<HiOutlineLightBulb className="text-2xl text-orange-500" />}
          eyebrow={labels.toReview}
          value={String(stats?.dueCount || 0)}
          tone="border border-orange-100 bg-orange-50 text-orange-600"
        />
      </div>
    </Card>
  );
}
