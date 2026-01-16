'use client';

import { memo, ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color: string;
}

export const StatCard = memo(function StatCard({
  label,
  value,
  icon,
  color,
}: StatCardProps) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm text-[#86868b] font-medium">{label}</p>
        <p className="text-2xl font-bold text-[#1d1d1f]">{value}</p>
      </div>
    </Card>
  );
});
