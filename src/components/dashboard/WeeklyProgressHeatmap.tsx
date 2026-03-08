'use client';

import { memo, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { HiOutlineChevronLeft, HiOutlineChevronRight } from '@/components/icons';

interface DailyActivity {
  questionsReviewed: number;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
}

interface WeeklyProgressHeatmapProps {
  weeklyActivity: Record<string, DailyActivity>;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getIntensityClass(questions: number): string {
  if (questions === 0) return 'bg-slate-50';
  if (questions <= 5) return 'bg-slate-200';
  if (questions <= 10) return 'bg-slate-400';
  if (questions <= 20) return 'bg-slate-600';
  return 'bg-slate-900';
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const WeeklyProgressHeatmap = memo(function WeeklyProgressHeatmap({
  weeklyActivity,
}: WeeklyProgressHeatmapProps) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const [weekOffset, setWeekOffset] = useState(0);

  const { weekDates, weekLabel, isCurrentWeek } = useMemo(() => {
    const today = new Date();
    const baseDate = new Date(today);
    baseDate.setDate(today.getDate() + weekOffset * 7);

    const weekStart = getWeekStart(baseDate);
    const dates: Date[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dates.push(d);
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const formatShort = (d: Date) =>
      `${d.getDate()}/${d.getMonth() + 1}`;

    return {
      weekDates: dates,
      weekLabel: `${formatShort(weekStart)} - ${formatShort(weekEnd)}`,
      isCurrentWeek: weekOffset === 0,
    };
  }, [weekOffset]);

  const handlePrevWeek = () => setWeekOffset((prev) => prev - 1);
  const handleNextWeek = () => {
    if (weekOffset < 0) setWeekOffset((prev) => prev + 1);
  };

  const todayKey = formatDateKey(new Date());

  return (
    <Card className="p-6 rounded-2xl shadow-sm border-gray-100/50 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#1d1d1f]">{t('weeklyProgress')}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <HiOutlineChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm text-[#86868b] min-w-[100px] text-center">
            {isCurrentWeek ? t('thisWeek') : weekLabel}
          </span>
          <button
            onClick={handleNextWeek}
            disabled={weekOffset >= 0}
            className={`p-1 rounded-full transition-colors ${weekOffset >= 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'
              }`}
          >
            <HiOutlineChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, i) => {
          const dateKey = formatDateKey(date);
          const activity = weeklyActivity?.[dateKey];
          const questions = activity?.questionsReviewed || 0;
          const xp = activity?.xpEarned || 0;

          return (
            <div key={dateKey} className="flex flex-col items-center gap-2">
              <span className="text-xs text-[#86868b] font-medium">
                {DAY_LABELS[i]}
              </span>
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${getIntensityClass(questions)}`}
                title={`${date.toLocaleDateString()}: ${questions} questions, ${xp} XP`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
        <span>{tCommon('less')}</span>
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-50 border border-slate-100" />
          <div className="w-3 h-3 rounded-sm bg-slate-200" />
          <div className="w-3 h-3 rounded-sm bg-slate-400" />
          <div className="w-3 h-3 rounded-sm bg-slate-600" />
          <div className="w-3 h-3 rounded-sm bg-slate-900" />
        </div>
        <span>{tCommon('more')}</span>
      </div>
    </Card>
  );
});
