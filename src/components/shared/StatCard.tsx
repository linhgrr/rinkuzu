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
    <Card className="p-5 flex items-center gap-4 rounded-2xl shadow-sm border-slate-200 bg-white hover:border-teal-400 hover:shadow-[0_0_15px_rgba(45,212,191,0.2)] transition-all duration-300">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} shrink-0`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-xl sm:text-2xl font-bold text-slate-900 truncate tracking-tight">{value}</p>
      </div>
    </Card>
  );
});
