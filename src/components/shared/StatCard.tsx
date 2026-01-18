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
    <Card className="p-5 flex items-center gap-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow border-gray-100/50">
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color} shrink-0`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-xl sm:text-2xl font-bold text-[#1d1d1f] truncate">{value}</p>
      </div>
    </Card>
  );
});
